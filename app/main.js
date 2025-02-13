const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Uncomment this block to pass the first stage

async function REPLFunction() {
    rl.question("$ ", (answer) => {
        console.log(`${answer}: command not found`);
        REPLFunction();
    });
}

REPLFunction();
