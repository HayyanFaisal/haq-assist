# Notes for Claude

## Git and GitHub: dont add yourself as collaborator

- Never add yourself as a collaborator or co-author. Commit messages get **no** `Co-Authored-By: Claude …` line, and pull request descriptions get **no** "Generated with Claude Code" line.
- Never add Claude, Codex or any bot account as a collaborator on the GitHub repository.
- Commits are authored by the team members only.

## Project

Haq Assist is a RAG app over official Pakistani law, built for the Generative AI course (BSE-7B). Start with `README.md`; the design choices and their numbers are in `docs/Haq_Assist_Explained.md`.

- All AI runs on GPU 1 (CUDA UUID `GPU-dcd92a54-ad5d-60fe-692f-264c71b64b3c`, llama.cpp `--device Vulkan2`). GPU 0 drives the display.
- Every number in the docs or slides must come from a file in `eval/results/` or `data/checks/`.
- Never accept a model licence on the user's behalf.
