from subprocess import run

run("npx tsc -p . && node dist/BoarBotApp.js deploy-commands", shell=True)