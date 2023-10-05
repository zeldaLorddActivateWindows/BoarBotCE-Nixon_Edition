from subprocess import Popen

Popen("npx tsc -p . && node dist/BoarBotApp.js deploy-commands", shell=True)