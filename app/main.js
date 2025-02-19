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
        console.log(`${command} is a shell builtin`);
    } else {
        console.log(`${command}: not found`);
    }
}
// Uncomment this block to pass the first stage

async function REPLFunction() {
    rl.question("$ ", (answer) => {
        if (answer.startsWith("type ")) {
            checkCommand(answer.substring("type ".length));
        } else if (answer.startsWith("echo ")) {
            rl.write(answer.substring(5));
        } else if (answer === "exit 0") {
            process.exit(0);
        } else {
            const paths = process.env.PATH.split(":");

            for (const pathEnv of paths) {
                let destPath = path.join(pathEnv, answer);
                if (fs.existsSync(destPath)) {
                    rl.write(`${answer} is ${destPath}\n`);
                    return;
                }
            }
            rl.write(`${answer}: command not found\n`);
        }

        REPLFunction();
    });
}

REPLFunction();
