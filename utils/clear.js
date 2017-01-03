let clearCode = '\033[2J';
if (process.platform === "win32") {
  clearCode = '\033c';
}
process.stdout.write(clearCode);
