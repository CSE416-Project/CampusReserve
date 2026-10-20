# Development Workflow

In order to ensure that everyone is on the same page with this project, we have developed a system for our workflow.

# Making Contributions

Each developer will create their own fork of the main repository. On this fork, they will make any changes and test before putting those changes into the main repository. To put changes into the main repository, a pull request (PR) will be made from the forked repository into the main repository. Then, at least one other developer, preferably someone who has worked with a similar area in the project, will need to do a code review and approve the changes. A developer can request a code review on the PR itself, or someone who would like to review can assign themselves as a reviewer. Once the PR is approved, the PR may be merged. All changes made will be tracked in the CHANGELOG.md file with the date of the change to help track the versions of code in the event we need to trace changes in the future.

# Communication

To communicate what needs to be done, GitHub Issues will be opened to describe what features need to be implemented or bugs that need to be fixed. The goal is for these Issues to be small pieces rather than large project features so that it is easier to divide the work. If a developer is taking on a certain Issue, they should assign themselves so that everyone else knows it is being worked on. Additionally, when someone is working on code on their fork but is not ready to merge it, they should have a PR opened from their fork to the main repository with WIP (work in progress) written in the description. Alternatively, a draft PR can be used. That way, everyone else can see what changes are being made in case those changes affect what they are working on or to prevent reinventing the wheel. Any PR that addresses an Issue should link that issue as this will create a notice in the Issue history and will allow other developers to easily see what is being addressed where. Note: developers need to be careful that these messages do not accidentally close an Issue that is uncompleted when PRs get merged.

The CHANGELOG should be updated after every major change to ensure we have a proper record of what is changed when. This could help prevent long searches in commit histories in the event that we need to revert code to an old version or track down a bug.

PR descriptions and commit messages will be descriptive as to what they do.

# Documentation

We will create a docs page for both users and developers. The developer who worked on a specific feature will be responsible for writing documentation on how it works in an easy to understand way. This is separate from comments written around the code to describe the code, though this should occur as well.

# Code Consistency

To ensure that the code is formatted consistently, a linter will be run prior to any commits. This linter will be decided upon in the future.

Tests will be used and run prior to any PR being merged to ensure that the new code does not break anything. There will be automated testing on the PR through CI/CD. A PR cannot be merged until every test is passed.
