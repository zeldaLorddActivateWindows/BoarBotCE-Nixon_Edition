from subprocess import run

run("bun install && npx tsc -p . && bun run dist/BoarBotApp.js", shell=True)