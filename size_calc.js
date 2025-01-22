#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const minPercentageArg = process.argv.find(arg => arg.startsWith('--p='));
const minPercentage = minPercentageArg ? parseFloat(minPercentageArg.split('=')[1]) : 2;

function getFolderSizeWithDetails(folderPath) {
    let totalSize = 0;
    let processedCount = 0;

    function calculateSize(dir) {
        const entries = fs.readdirSync(dir);
        let size = 0;
        const children = [];
        const peerDependencies = new Set();
        const nodeName = path.basename(dir);

        for (const entry of entries) {
            const entryPath = path.join(dir, entry);
            const stats = fs.statSync(entryPath);
            if (stats.isDirectory()) {
                const child = calculateSize(entryPath);
                children.push(child);
                size += child.size;
                child.peerDependencies.forEach(dep => {
                    if(!(dep.startsWith(nodeName + "/") && nodeName.startsWith("@"))) {
                        peerDependencies.add(dep)
                    }
                });
            } else {
                size += stats.size;
            }

            processedCount++;
            if (processedCount % 100 === 0) {
                process.stdout.write(`\rProcessed ${processedCount} entries...`);
            }
        }

        // Check for peer dependencies in the current package
        const packageJsonPath = path.join(dir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.peerDependencies && nodeName !== 'node_modules') {
                Object.keys(packageJson.peerDependencies).forEach(dep => peerDependencies.add(dep));
            }
        }

        return {
            name: nodeName,
            size,
            peerDependencies,
            children: children.sort((a, b) => b.size - a.size),
        };
    }

    const rootDetails = calculateSize(folderPath);
    totalSize = rootDetails.size;
    console.log('\n'); // Clear progress line
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
        const peerText = (node.peerDependencies.size > 0 && node.name != "node_modules") 
            ? chalk.blue(`(peer deps: ${Array.from(node.peerDependencies).join(', ')})`) 
            : '';

        console.log(`${indent}- ${chalk.yellow(`[${percentage}%]`)} ${color(node.name)} ${chalk.gray(`(${sizeMB} MB)`)} ${peerText}`);

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