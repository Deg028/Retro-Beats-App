@AGENTS.md

Everything an agent needs to pick this project up on any machine is in AGENTS.md: the layout, the current version and what was checked on the phone, what is pending, the decisions taken, how to set up a new PC (Git LFS, EAS, wireless ADB) and how to test on the phone. When a session changes any of that, update AGENTS.md in the same commit, so the next session does not start from zero.

Process rules the person has set (details in AGENTS.md, "How we work"): group changes into the next version instead of building an APK for each one; commit locally but **push only when the person asks**; always test a release on the phone over wireless ADB and write down what was and was not tested; reply and write UI copy in Spanish.
