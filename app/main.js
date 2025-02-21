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

// A custom parseArgs that implements POSIX-like quoting:
// - Outside quotes: a backslash always escapes the next character (and is removed).
// - Inside double quotes: a backslash only escapes $, `, ", \, or newline;
//   if it precedes any other character, the backslash is preserved.
function parseArgs(input) {
    let args = [];
    let currentArg = [];
    let inSingleQuotes = false;
    let inDoubleQuotes = false;
    let escapeNext = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (escapeNext) {
            if (inDoubleQuotes) {
                // In double quotes, only these characters are specially escaped.
                if (
                    char === "$" ||
                    char === "`" ||
                    char === '"' ||
                    char === "\\" ||
                    char === "\n"
                ) {
                    // Backslash escapes these: do not preserve the backslash.
                    currentArg.push(char);
                } else {
                    // For any other character, the backslash is left in.
                    currentArg.push("\\", char);
                }
            } else {
                // Outside of double quotes (or in single quotes), backslash always escapes.
                currentArg.push(char);
            }
            escapeNext = false;
            continue;
        }

        if (char === "\\") {
            // In single quotes, backslashes are literal.
            if (inSingleQuotes) {
                currentArg.push(char);
            } else {
                escapeNext = true;
            }
            continue;
        }

        if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
            continue;
        }

        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
            continue;
        }

        if (char === " " && !inSingleQuotes && !inDoubleQuotes) {
            if (currentArg.length > 0) {
                args.push(currentArg.join(""));
                currentArg = [];
            }
            continue;
        }

        currentArg.push(char);
    }

    if (currentArg.length > 0) {
        args.push(currentArg.join(""));
    }
    return args;
}

function handleEcho(answer) {
    const args = parseArgs(answer).slice(1); // Remove "echo" command
    const output = args.join(" ");
    rl.write(`${output}\n`);
}

function handleInvalid(answer) {
    rl.write(`${answer}: command not found\n`);
}

function handleExit() {
    rl.close();
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
    const args = parseArgs(answer).slice(1); // Extract file paths after "cat"
    if (args.length === 0) {
        console.error("cat: missing file operand");
        return;
    }
    for (const filePath of args) {
        try {
            const data = fs.readFileSync(filePath, "utf-8");
            process.stdout.write(data);
        } catch (err) {
            if (err.code === "ENOENT") {
                console.error(`cat: ${filePath}: No such file or directory`);
            } else {
                console.error(`cat: ${filePath}: Permission denied`);
            }
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
