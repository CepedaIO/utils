import { ChildProcess, spawn, SpawnOptionsWithoutStdio } from "child_process";

type PassthruOptions = SpawnOptionsWithoutStdio & {
  child?: (child: ChildProcess) => void
}

/**
 * @description Simple child spawn that inherits process
 */
export async function run(command: string, args: string[], options: PassthruOptions = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options
  });

  if (options.child) options.child(child)

  return new Promise((resolve, reject) => {
    child.on('exit', (code) => resolve(code));
    child.on('error', (err) => reject(err))
  });
}
