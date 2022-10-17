import execa from 'execa';
import color from 'colors';
import Log from './logger';

function workingAnimation(message: string, interval = 200) {
    const chars = ['|', '/', '―', '\\'];
    let x = 0;

    // For the animation, we write to stdout a message, then use process.stdout.clearLine() to erase the line
    // and on the same line write an updated message. This keeps the message updating on the same console line.
    // When we run the entire test suite using 'npm run test', process.stdout.clearline() is not available.
    // We don't really need to print the animation in this case anyway, so we skip the animation when
    // process.stdout.clearline() is not available.
    if (!process.stdout.clearLine) return { stop: () => {/*noop*/ } };

    const handle = setInterval(() => {
        process.stdout.write(`\r ${color.green(chars[x++])} ${message}`);
        x %= chars.length;
    }, interval);

    return {
        stop: () => {
            clearInterval(handle);
            process.stdout.clearLine(0);
            process.stdout.write('\n');
        }
    }
}

export function runCommandSync(command: string, log?: Log): CommandResult {
    let result;
    const start = Date.now();

    try {
        result = execa.commandSync(command) as CommandResult;
    } catch (failed) {
        result = failed as CommandResult;
    }
    console.debug(resultToString(result, start));
    log?.debug(resultToString(result, start));
    return result;
}

export async function runCommand(command: string, message?: string, log?: Log): Promise<CommandResult> {

    let result;
    const start = Date.now();

    const animation = workingAnimation(message || command);

    try {
        result = await execa.command(command) as CommandResult;
    } catch (failed) {
        result = failed as CommandResult;
    }

    animation.stop();
    console.debug(resultToString(result, start));
    log?.debug(resultToString(result, start));
    return result;
}


function resultToString(result: CommandResult, start: number): string {
    return `Running command : ${result.command}\n \
duration: ${((Date.now() - start) / 1000).toFixed(2)} seconds\n  \
exitcode : ${result.exitCode}\n  \
stdout: ${result.stdout.split('\n').join("\n          ")}\n  \
stderr: ${result.stderr.split('\n').join("\n          ")}`;
}