/**
 * Safe process spawning and termination.
 *
 * We always spawn without a shell and with an explicit argv array, so task input can
 * never be interpreted as shell syntax. `spawnImpl` is injectable for tests.
 */
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

export type SpawnFn = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

export interface SpawnConfig {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

/** Spawn a piped, shell-free child process. */
export function spawnProcess(
  command: string,
  args: readonly string[],
  config: SpawnConfig,
  spawnImpl: SpawnFn = spawn,
): ChildProcess {
  return spawnImpl(command, args, {
    cwd: config.cwd,
    env: config.env ?? process.env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  });
}

/** True once the process has exited (by code or signal). */
export function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * Terminate a child process: SIGTERM, then SIGKILL after `graceMs` if it has not exited.
 * Resolves once the process is gone (or was already gone).
 */
export function terminate(child: ChildProcess, graceMs = 4000): Promise<void> {
  if (hasExited(child)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve();
    };
    child.once("exit", finish);
    const killTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      finish();
    }, graceMs);
    // Do not keep the event loop alive solely for the grace timer.
    if (typeof killTimer.unref === "function") killTimer.unref();
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
    }
  });
}
