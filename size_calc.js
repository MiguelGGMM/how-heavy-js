#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const minPercentageArg = process.argv.find(arg => arg.startsWith('--min-percentage='));
const minPercentage = minPercentageArg ? parseFloat(minPercentageArg.split('=')[1]) : 2;

function getFolderSizeWithDetails(folderPath) {
    let totalSize = 0;

    function calculateSize(dir) {
        const entries = fs.readdirSync(dir);
        let size = 0;
        const children = [];

        for (const entry of entries) {
            const entryPath = path.join(dir, entry);
            const stats = fs.statSync(entryPath);
            if (stats.isDirectory()) {
                const child = calculateSize(entryPath);
                children.push(child);
                size += child.size;
            } else {
                size += stats.size;
            }
        }

        return {
            name: path.basename(dir),
            size,
            children: children.sort((a, b) => b.size - a.size),
        };
    }

    const rootDetails = calculateSize(folderPath);
    totalSize = rootDetails.size;
    return { totalSize, details: rootDetails };
}

function getDevDependencies() {
    const packageJsonPath = path.resolve('package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.error(chalk.red('package.json not found in the current directory.'));
        process.exit(1);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return new Set(Object.keys(packageJson.devDependencies || {}));
}

function printTree(node, totalSize, minPercentage, devDependencies, indent = '') {
    const sizeMB = (node.size / 1024 / 1024).toFixed(1);
    const percentage = ((node.size / totalSize) * 100).toFixed(1);

    const isDevDependency = devDependencies.has(node.name);
    const color = isDevDependency ? chalk.gray : chalk.bold;

    if (percentage >= minPercentage) {
        console.log(`${indent}- ${chalk.yellow(`[${percentage}%]`)} ${color(node.name)} ${chalk.gray(`(${sizeMB} MB)`)}`);

        for (const child of node.children) {
            printTree(child, totalSize, minPercentage, devDependencies, indent + '  ');
        }
    }
}

const folderPath = path.resolve('node_modules');
if (!fs.existsSync(folderPath)) {
    console.error(chalk.red(`The folder "${folderPath}" does not exist.`));
    process.exit(1);
}

if (isNaN(minPercentage) || minPercentage < 0 || minPercentage > 100) {
    console.error(chalk.red('Invalid value for --min-percentage. It should be a number between 0 and 100.'));
    process.exit(1);
}

const devDependencies = getDevDependencies();
const { totalSize, details } = getFolderSizeWithDetails(folderPath);

details.children.sort((a, b) => b.size - a.size);

console.log(chalk.green(`Total size of node_modules: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`));
printTree(details, totalSize, minPercentage, devDependencies, '');