from subprocess import run

run("bun install", shell=True)
run("npx tsc -p . && bun run dist/BoarBotApp.js", shell=True)