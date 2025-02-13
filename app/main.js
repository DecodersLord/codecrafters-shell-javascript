const readline = require("readline");

const builtin = ["help", "clear", "exit", "echo", "type"];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function checkCommand(command) {
    if (builtin.includes(command)) {
        console.log(`${command}: is a shell builtin`);
    } else {
        console.log(`${command}: command not found`);
    }
}
// Uncomment this block to pass the first stage

async function REPLFunction() {
    rl.question("$ ", (answer) => {
        if (answer.startsWith("type ")) {
            checkCommand(answer.substring("type ".length));
        } else if (answer.startsWith("echo ")) {
            console.log(answer.substring(5));
        } else if (answer === "exit 0") {
            process.exit(0);
        } else {
            console.log(`${answer}: command not found`);
        }

        REPLFunction();
    });
}

REPLFunction();
