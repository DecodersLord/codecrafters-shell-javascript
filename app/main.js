const readline = require("readline");
const path = require("path");
const fs = require("fs");

const commands = ["help", "clear", "exit", "echo", "type"];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function checkCommand(command) {
    if (commands.includes(command)) {
        rl.write(`${command} is a shell builtin\n`);
    } else {
        const paths = process.env.PATH.split(":");

        for (const pathEnv of paths) {
            let destPath = path.join(pathEnv, command);
            if (fs.existsSync(destPath) && fs.statSync(destPath).isFile()) {
                rl.write(`${command} is ${destPath}\n`);
                return;
            }
        }
        rl.write(`${command}: not found\n`);
    }
}
// Uncomment this block to pass the first stage

async function REPLFunction() {
    rl.question("$ ", (answer) => {
        if (answer.startsWith("type ")) {
            checkCommand(answer.substring("type ".length));
        } else if (answer.startsWith("echo ")) {
            rl.write(`${answer.substring(5)}\n`);
        } else if (answer === "exit 0") {
            process.exit(0);
        } else {
            rl.write(`${answer}: command not found\n`);
        }

        REPLFunction();
    });
}

REPLFunction();
