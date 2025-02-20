const readline = require("readline/promises");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFileSync } = require("node:child_process");

const HOMEDIR = process.env.HOME || process.env.USERPROFILE || os.homedir();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function parseArgs(input) {
    const regex = /'([^']*)'|"([^"]*)"|(\S+)/g;
    let match;
    const result = [];
    let buffer = ""; // To merge adjacent quoted strings

    while ((match = regex.exec(input)) !== null) {
        let part = match[1] || match[2] || match[3];

        // If buffer is not empty, merge with previous part (adjacent quotes case)
        if (buffer) {
            buffer += part;
        } else {
            buffer = part;
        }

        // If next character is a space, push buffer as a separate argument
        if (regex.lastIndex >= input.length || input[regex.lastIndex] === " ") {
            result.push(buffer);
            buffer = ""; // Reset buffer
        }
    }

    if (buffer) result.push(buffer); // Push last element if any

    return result;
}

function handleInvalid(answer) {
    rl.write(`${answer}: command not found\n`);
}

function handleExit() {
    rl.close();
}

function handleEcho(answer) {
    const args = parseArgs(answer).slice(1); // Remove "echo" command
    const output = args.join(" "); // Join arguments correctly

    rl.write(`${output}\n`);
}

function handleType(answer) {
    const command = answer.split(" ")[1];
    const commands = ["exit", "echo", "type", "pwd"];
    if (commands.includes(command.toLowerCase())) {
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

function handleFile(answer) {
    const fileName = answer.split(" ")[0];
    const args = answer.split(" ").slice(1);
    const paths = process.env.PATH.split(":");
    for (const pathEnv of paths) {
        let destPath = path.join(pathEnv, fileName);
        if (fs.existsSync(destPath) && fs.statSync(destPath).isFile()) {
            execFileSync(fileName, args, {
                encoding: "utf-8",
                stdio: "inherit",
            });
        }
    }
}

function handleReadFile(answer) {
    const args = parseArgs(answer).slice(1); // Extract file paths (excluding "cat")

    if (args.length === 0) {
        console.error("cat: missing file operand");
        return;
    }

    for (const filePath of args) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            try {
                process.stdout.write(fs.readFileSync(filePath, "utf-8"));
            } catch (err) {
                console.error(`cat: ${filePath}: Permission denied`);
            }
        } else {
            console.error(`cat: ${filePath}: No such file or directory`);
        }
    }
}

function handlePWD() {
    rl.write(`${process.cwd()}\n`);
}

function handleChangeDirectory(answer) {
    const directory = answer.split(" ")[1];
    try {
        if (directory === "~") {
            process.chdir(HOMEDIR);
        } else {
            process.chdir(directory);
        }
        question();
    } catch (err) {
        rl.write(`cd: ${directory}: No such file or directory\n`);
    }
}
async function question() {
    const answer = await rl.question("$ ");

    if (answer.startsWith("invalid")) {
        handleInvalid(answer);
        question();
    } else {
        switch (answer.split(" ")[0].toLowerCase()) {
            case "exit":
                handleExit();
                break;
            case "echo":
                handleEcho(answer);
                question();
                break;
            case "type":
                handleType(answer);
                question();
                break;
            case "pwd":
                handlePWD();
                question();
                break;
            case "cd":
                handleChangeDirectory(answer);
                question();
                break;
            case "cat":
                handleReadFile(answer);
                question();
                break;
            default:
                handleFile(answer);
                question();
        }
    }
}

question();
