const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Uncomment this block to pass the first stage
rl.question("$ ", (answer) => {
    console.log("invalid_command: command not found");
    rl.close();
});
