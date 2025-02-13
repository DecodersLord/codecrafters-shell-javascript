const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Uncomment this block to pass the first stage

async function REPLFunction() {
    rl.question("$ ", (answer) => {
        if (answer === "exit 0") {
            process.exit(0);
        }
        console.log(`${answer}: command not found`);
        REPLFunction();
    });
}

REPLFunction();
