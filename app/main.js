const readline = require("readline/promises");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFileSync, spawnSync } = require("node:child_process");

const HOMEDIR = process.env.HOME || process.env.USERPROFILE || os.homedir();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer,
    prompt: "$ ",
});

function completer(line) {
    const completions = ["exit", "echo", "type", "pwd", "cd"];
    const hits = completions.filter((c) => c.startsWith(line));

    if (hits.length === 0) {
        process.stdout.write(`\x07`);
        return [[], line];
    }
    // Otherwise, return all hits (or completions if no hits)
    return [hits.length ? hits.map((h) => h + " ") : completions, line];
}

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

function handleRedirect(answer) {
    // Determine which redirection operator is present.
    const parts = parseArgs(answer);
    const operators = ["2>>", "1>>", "2>", "1>", ">>", ">"];
    let op = null;
    let opIndex = -1;

    // Find the last valid operator in the parsed arguments
    for (let i = 0; i < parts.length; i++) {
        if (operators.includes(parts[i])) {
            op = parts[i];
            opIndex = i;
        }
    }

    if (!op || opIndex === parts.length - 1) return;

    const filename = parts[opIndex + 1];
    const commandParts = parts.slice(0, opIndex);
    if (commandParts.length === 0) return;

    // Determine operation parameters
    const isAppend = op.endsWith(">>");
    const isStderr = op.startsWith("2");
    const flag = isAppend ? "a" : "w";

    // Execute command
    const result = spawnSync(commandParts[0], commandParts.slice(1), {
        encoding: "utf-8",
        stdio: ["inherit", "pipe", "pipe"],
    });

    try {
        // Always create directory structure
        fs.mkdirSync(path.dirname(filename), { recursive: true });

        // Get content to write (empty string if undefined)
        const content = (isStderr ? result.stderr : result.stdout) || "";

        // Always write to file (creates empty file if needed)
        fs.writeFileSync(filename, content, {
            flag: flag,
            mode: 0o644,
        });

        // Print non-redirected output to console
        const consoleStream = isStderr ? process.stdout : process.stderr;
        const consoleOutput = isStderr ? result.stdout : result.stderr;
        if (consoleOutput) {
            consoleStream.write(consoleOutput);
        }
    } catch (err) {
        process.stderr.write(
            `${commandParts[0]}: ${filename}: ${err.message}\n`
        );
    }
}

// ----- Command Handlers -----

function handleEcho(answer) {
    const parts = parseArgs(answer);
    const output = parts.slice(1).join(" ");
    // Use process.stdout instead of rl.write()
    process.stdout.write(output + "\n");
}

function handleInvalid(answer) {
    process.stdout.write(`${answer}: command not found\n`);
}

function handleExit() {
    rl.close();
}

function handleType(answer) {
    const parts = parseArgs(answer);
    const command = parts[1];
    const builtins = ["exit", "echo", "type", "pwd"];
    if (builtins.includes(command.toLowerCase())) {
        process.stdout.write(`${command} is a shell builtin\n`);
    } else {
        const paths = process.env.PATH.split(":");
        for (const p of paths) {
            let destPath = path.join(p, command);
            if (fs.existsSync(destPath) && fs.statSync(destPath).isFile()) {
                process.stdout.write(`${command} is ${destPath}\n`);
                return;
            }
        }
        process.stdout.write(`${command}: not found\n`);
    }
}

function handleFile(answer) {
    // Use parseArgs to handle any quoting in the command name
    const parts = parseArgs(answer);
    const executable = parts[0]; // the command name (may be quoted)
    const args = parts.slice(1);
    const paths = process.env.PATH.split(":");
    for (const pathEnv of paths) {
        let destPath = path.join(pathEnv, executable);
        if (fs.existsSync(destPath) && fs.statSync(destPath).isFile()) {
            // Use argv0 option so that the child process sees the bare command name.
            execFileSync(destPath, args, {
                encoding: "utf-8",
                stdio: "inherit",
                argv0: executable,
            });
            return;
        }
    }
    //console.log(`${executable}: command not found`);
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

function handlePWD() {
    process.stdout.write(`${process.cwd()}\n`);
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
        rl.prompt();
    } catch (err) {
        process.stdout.write(`cd: ${directory}: No such file or directory\n`);
    }
}

// Attach a one-time event listener (it remains active)
function handleInput(line) {
    if (line.startsWith("invalid")) {
        handleInvalid(line);
        rl.prompt();
        return;
    }

    const parts = parseArgs(line);
    if (parts.length === 0) {
        rl.prompt();
        return;
    }

    const cmd = parts[0]?.toLowerCase();
    const redirectOperators = ["2>>", "1>>", "2>", "1>", ">>", ">"];
    const foundOperator = redirectOperators.find((op) => parts.includes(op));

    if (foundOperator) {
        handleRedirect(line);
    } else {
        switch (cmd) {
            case "exit":
                handleExit();
                break;
            case "echo":
                handleEcho(line);
                break;
            case "type":
                handleType(line);
                break;
            case "pwd":
                handlePWD();
                break;
            case "cd":
                handleChangeDirectory(line);
                break;
            case "cat":
                handleReadFile(line);
                break;
            default:
                handleFile(line);
        }
    }

    rl.prompt();
}

rl.on("line", handleInput);

// Optionally handle close event:
rl.on("close", () => {
    process.exit(0);
});

// ----- Main REPL Loop -----
rl.prompt();
