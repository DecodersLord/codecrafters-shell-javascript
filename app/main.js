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

/**
 * parseArgs: split the input into arguments following POSIX-like quoting rules.
 *
 * Rules:
 * - Outside quotes, a backslash escapes the next character.
 * - Inside double quotes, a backslash only escapes $, `, ", \, or newline.
 * - Inside single quotes, everything is literal.
 */
function parseArgs(input) {
    let args = [];
    let current = [];
    let inSingle = false;
    let inDouble = false;
    let escapeNext = false;

    for (let i = 0; i < input.length; i++) {
        let ch = input[i];

        if (escapeNext) {
            if (inDouble) {
                // In double quotes, only these characters are specially escaped.
                if (
                    ch === "$" ||
                    ch === "`" ||
                    ch === '"' ||
                    ch === "\\" ||
                    ch === "\n"
                ) {
                    current.push(ch);
                } else {
                    // Otherwise, leave the backslash in.
                    current.push("\\", ch);
                }
            } else {
                current.push(ch);
            }
            escapeNext = false;
            continue;
        }

        if (ch === "\\") {
            // If in single quotes, backslash is literal.
            if (inSingle) {
                current.push(ch);
            } else {
                escapeNext = true;
            }
            continue;
        }

        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            continue; // do not include the outer single quotes
        }
        if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
            continue; // do not include the outer double quotes
        }

        if (ch === " " && !inSingle && !inDouble) {
            if (current.length > 0) {
                args.push(current.join(""));
                current = [];
            }
            continue;
        }

        current.push(ch);
    }

    if (current.length > 0) {
        args.push(current.join(""));
    }

    return args;
}

// ----- Command Handlers -----

function handleEcho(answer) {
    const parts = parseArgs(answer);
    // parts[0] is "echo"; join the rest with a space.
    const output = parts.slice(1).join(" ");
    rl.write(`${output}\n`);
}

function handleInvalid(answer) {
    rl.write(`${answer}: command not found\n`);
}

function handleExit() {
    rl.close();
}

function handleType(answer) {
    const parts = parseArgs(answer);
    const command = parts[1];
    const builtins = ["exit", "echo", "type", "pwd"];
    if (builtins.includes(command.toLowerCase())) {
        rl.write(`${command} is a shell builtin\n`);
    } else {
        const paths = process.env.PATH.split(":");
        for (const p of paths) {
            let destPath = path.join(p, command);
            if (fs.existsSync(destPath) && fs.statSync(destPath).isFile()) {
                rl.write(`${command} is ${destPath}\n`);
                return;
            }
        }
        rl.write(`${command}: not found\n`);
    }
}

function handleReadFile(answer) {
    const args = parseArgs(answer).slice(1); // Extract file paths (excluding "cat")
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

function handleReadFile(answer) {
    const parts = parseArgs(answer);
    const args = parts.slice(1);
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
    const parts = parseArgs(answer);
    const directory = parts[1];
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

// ----- Main REPL Loop -----

async function question() {
    const answer = await rl.question("$ ");
    if (answer.startsWith("invalid")) {
        handleInvalid(answer);
        question();
    } else {
        const parts = parseArgs(answer);
        const cmd = parts[0]?.toLowerCase();
        switch (cmd) {
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
