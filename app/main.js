const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Uncomment this block to pass the first stage

async function REPLFunction() {
    rl.question("$ ", (answer) => {
        if (answer.startsWith("echo ")) {
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
