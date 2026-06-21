const checkName = process.argv[2];

if (!checkName) {
  throw new Error("A placeholder check name is required.");
}

console.error(
  `[not implemented] ${checkName} is reserved for a later Milestone 4A phase.`
);
process.exitCode = 2;
