const readline = require("readline/promises");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFileSync, spawnSync } = require("child_process");

const HOMEDIR = process.env.HOME || process.env.USERPROFILE || os.homedir();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// A custom parser that obeys basic POSIX-like quoting rules.
function parseArgs(input) {
    let args = [];
    let currentArg = [];
    let inSingleQuotes = false;
    let inDoubleQuotes = false;
    let escapeNext = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (escapeNext) {
            currentArg.push(char);
            escapeNext = false;
            continue;
        }

        if (char === "\\") {
            // In single quotes, backslash is literal.
            if (inSingleQuotes) {
                currentArg.push(char);
            } else {
                escapeNext = true;
            }
            continue;
        }

        if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
            continue; // Do not include the quotes.
        }
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
            continue; // Do not include the quotes.
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

// STDOUT redirection handler (for >, 1>, >>)
function handleRedirect(answer) {
    let op = "";
    let opIndex = -1;
    if (answer.indexOf(">>") !== -1) {
        op = ">>";
        opIndex = answer.indexOf(">>");
    } else if (answer.indexOf("1>") !== -1) {
        op = "1>";
        opIndex = answer.indexOf("1>");
    } else if (answer.indexOf(">") !== -1) {
        op = ">";
        opIndex = answer.indexOf(">");
    }
    const commandPart = answer.slice(0, opIndex).trim();
    const filename = answer.slice(opIndex + op.length).trim();
    // ">>" means append; both "1>" and ">" mean overwrite.
    const flag = op === ">>" ? "a" : "w";
    const parts = parseArgs(commandPart);
    if (parts.length === 0) return;
    const cmd = parts[0];
    const args = parts.slice(1);
    let output = "";
    try {
        output = execFileSync(cmd, args, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });
    } catch (error) {
        // Even if the command fails, capture its stdout.
        output = error.stdout || "";
        if (error.stderr) {
            process.stderr.write(error.stderr);
        }
    }
    try {
        fs.writeFileSync(filename, output, { flag: flag });
    } catch (err) {
        if (err.code === "ENOENT") {
            console.error(`${cmd}: ${filename}: No such file or directory`);
        } else {
            console.error(`${cmd}: ${filename}: Permission denied`);
        }
    }
}

// STDERR redirection handler (for 2>)
function handleStderrRedirect(answer) {
    const op = "2>";
    const opIndex = answer.indexOf(op);
    if (opIndex === -1) return;
    const commandPart = answer.slice(0, opIndex).trim();
    const filename = answer.slice(opIndex + op.length).trim();
    const parts = parseArgs(commandPart);
    if (parts.length === 0) return;
    const cmd = parts[0];
    const args = parts.slice(1);
    // Use spawnSync to capture stderr regardless of exit code.
    const result = spawnSync(cmd, args, { encoding: "utf-8" });
    const errOutput = result.stderr;
    try {
        fs.writeFileSync(filename, errOutput, { flag: "w" });
    } catch (err) {
        if (err.code === "ENOENT") {
            console.error(`${cmd}: ${filename}: No such file or directory`);
        } else {
            console.error(`${cmd}: ${filename}: Permission denied`);
        }
    }
}

function handleEcho(answer) {
    const args = parseArgs(answer).slice(1); // Remove the "echo" command
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

function handleFile(answer) {
    const parts = parseArgs(answer);
    const executable = parts[0];
    const args = parts.slice(1);
    const paths = process.env.PATH.split(":");
    for (const p of paths) {
        let destPath = path.join(p, executable);
        if (fs.existsSync(destPath) && fs.statSync(destPath).isFile()) {
            // Set argv0 so the child sees the bare command name.
            execFileSync(destPath, args, {
                encoding: "utf-8",
                stdio: "inherit",
                argv0: executable,
            });
            return;
        }
    }
    console.log(`${executable}: command not found`);
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

async function question() {
    const answer = await rl.question("$ ");
    // Check for stderr redirection first.
    if (answer.includes("2>")) {
        handleStderrRedirect(answer);
        question();
        return;
    }
    // Then check for stdout redirection.
    if (
        answer.includes("1>") ||
        answer.includes(">>") ||
        (answer.includes(">") && !answer.includes("2>"))
    ) {
        handleRedirect(answer);
        question();
        return;
    }

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
