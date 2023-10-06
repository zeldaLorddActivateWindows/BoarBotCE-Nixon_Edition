from subprocess import run

run("npm i", shell=True)
run("npx tsc -p . && node dist/BoarBotApp.js deploy-commands", shell=True)