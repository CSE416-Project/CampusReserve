"""Authentication endpoints: register, login, and current-user."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.auth_token import KIND_RESET, KIND_VERIFY
from models.user import User, UserRole
from services import auth_tokens, mailer
from authentication import (
    authenticate_user,
    create_access_token,
    hash_password,
    get_current_user,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Request/response schemas (Pydantic, separate from the DB model) ---
class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: UserRole

    class Config:
        from_attributes = True  # lets it read from the SQLAlchemy model


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Endpoints ---
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new account. New users default to the club_leader role,
    unverified; an admin verifies them and assigns their organization."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role=UserRole.CLUB_LEADER,
    )
    db.add(user)
    db.flush()
    raw = auth_tokens.create_token(db, user, KIND_VERIFY)
    db.commit()
    db.refresh(user)
    _email_verify_link(user, raw)
    return UserResponse(id=str(user.id), email=user.email, name=user.name, role=user.role)


def _email_verify_link(user: User, raw: str) -> None:
    mailer.send_email(
        user.email, "Confirm your CampusReserve email",
        f"Hi {user.name},\n\nWelcome to CampusReserve! Open this link to confirm your email "
        f"and finish setting up your account:\n\n{mailer.app_url()}/verify-email?token={raw}\n\n"
        "The link works for 24 hours. If you didn't create an account, you can ignore this email.\n")


def _find_user(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()


@router.post("/token", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Log in with email (as the username field) and password; returns a token."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Only said after the password was right, so this can't be used to find out who has an account.
    # 403, not 401: a 401 makes the website think a saved login expired.
    if auth_tokens.is_pending_verification(db, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "email_not_verified",
                    "message": "Please confirm your email first. We sent you a link when you signed up."},
        )
    return TokenResponse(access_token=create_access_token(user))


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
def verify_email(payload: TokenRequest, db: Session = Depends(get_db)):
    """The link in the signup email lands here (through the website). After this the person can log in."""
    row = auth_tokens.find_valid(db, payload.token, KIND_VERIFY)
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This confirmation link is invalid or has expired. Log in to get a new one.")
    user = db.query(User).filter(User.id == row.user_id).first()
    auth_tokens.mark_verified(db, user)
    db.commit()


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
def resend_verification(payload: EmailRequest, db: Session = Depends(get_db)):
    """Send the signup link again. Always answers the same, so it can't be used to look up accounts."""
    user = _find_user(db, payload.email)
    if user and auth_tokens.is_pending_verification(db, user) and not auth_tokens.recently_sent(db, user, KIND_VERIFY):
        raw = auth_tokens.create_token(db, user, KIND_VERIFY)
        db.commit()
        _email_verify_link(user, raw)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(payload: EmailRequest, db: Session = Depends(get_db)):
    """Email a link for choosing a new password. Always answers the same, whether or not the email has an account."""
    user = _find_user(db, payload.email)
    if user and user.is_active and not auth_tokens.recently_sent(db, user, KIND_RESET):
        raw = auth_tokens.create_token(db, user, KIND_RESET)
        db.commit()
        mailer.send_email(
            user.email, "Reset your CampusReserve password",
            f"Hi {user.name},\n\nSomeone (hopefully you) asked to reset your CampusReserve password. "
            f"Open this link to choose a new one:\n\n{mailer.app_url()}/reset-password?token={raw}\n\n"
            "The link works for 1 hour and only once. If you didn't ask for this, you can ignore this email; "
            "your password has not changed.\n")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Set a new password using the emailed link. The link works once."""
    row = auth_tokens.find_valid(db, payload.token, KIND_RESET)
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This reset link is invalid or has expired. Ask for a new one.")
    user = db.query(User).filter(User.id == row.user_id).first()
    user.password_hash = hash_password(payload.new_password)
    row.used_at = datetime.utcnow()
    auth_tokens.mark_verified(db, user)   # they got an email at this address, so it is confirmed
    db.commit()


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    """Return the currently logged-in user."""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change your own password. You must give the current one.

    A wrong current password is a 400, not a 401, because a 401 makes the
    website think your login expired and signs you out."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Your current password is incorrect.")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Choose a new password that is different from your current one.")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
