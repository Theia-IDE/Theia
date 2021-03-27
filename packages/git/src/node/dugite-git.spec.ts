/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as upath from 'upath';

import * as path from 'path';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { expect } from 'chai';
import { Git } from '../common/git';
import { git as gitExec } from './git-exec-provider';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { WorkingDirectoryStatus, Repository, GitUtils, GitFileStatus, GitFileChange } from '../common';
import { createGit } from './test/binding-helper';
import { isWindows } from '@theia/core/lib/common/os';

/* eslint-disable max-len, no-unused-expressions */

const track = temp.track();

describe('git', async function (): Promise<void> {

    this.timeout(10000);

    after(async () => {
        track.cleanupSync();
    });

    describe('git', () => {

        it('No embedded Git, no GPL', () => {
            // __dirname is <theia>/packages/git/lib/node
            const git_node_modules = path.join(__dirname, '..', '..', 'node_modules');
            expect(fs.existsSync(git_node_modules)).to.be.true;
            expect(fs.existsSync(path.join(git_node_modules, 'dugite'))).to.be.false;
            expect(fs.existsSync(path.join(git_node_modules, 'dugite-no-gpl'))).to.be.false;

            const node_modules = path.join(__dirname, '..', '..', '..', '..', 'node_modules');
            expect(fs.existsSync(node_modules)).to.be.true;
            expect(fs.existsSync(path.join(node_modules, 'dugite'))).to.be.false;
            expect(fs.existsSync(path.join(node_modules, 'dugite-no-gpl'))).to.be.true;
            expect(fs.existsSync(path.join(node_modules, 'dugite-no-gpl', 'git'))).to.be.false;
        });

    });

    describe('repositories', async () => {

        it('should discover only first repository', async () => {

            const root = track.mkdirSync('discovery-test-1');
            fs.mkdirSync(path.join(root, 'A'));
            fs.mkdirSync(path.join(root, 'B'));
            fs.mkdirSync(path.join(root, 'C'));
            const git = await createGit();
            await initRepository(path.join(root, 'A'));
            await initRepository(path.join(root, 'B'));
            await initRepository(path.join(root, 'C'));
            const workspaceRootUri = FileUri.create(root).toString();
            const repositories = await git.repositories(workspaceRootUri, { maxCount: 1 });
            expect(repositories.length).to.deep.equal(1);

        });

        it('should discover all nested repositories', async () => {

            const root = track.mkdirSync('discovery-test-2');
            fs.mkdirSync(path.join(root, 'A'));
            fs.mkdirSync(path.join(root, 'B'));
            fs.mkdirSync(path.join(root, 'C'));
            const git = await createGit();
            await initRepository(path.join(root, 'A'));
            await initRepository(path.join(root, 'B'));
            await initRepository(path.join(root, 'C'));
            const workspaceRootUri = FileUri.create(root).toString();
            const repositories = await git.repositories(workspaceRootUri, {});
            expect(repositories.map(r => path.basename(FileUri.fsPath(r.localUri))).sort()).to.deep.equal(['A', 'B', 'C']);

        });

        it('should discover all nested repositories and the root repository which is at the workspace root', async function (): Promise<void> {
            if (isWindows) {
                // https://github.com/eclipse-theia/theia/issues/933
                this.skip();
                return;
            }

            const root = track.mkdirSync('discovery-test-3');
            fs.mkdirSync(path.join(root, 'BASE'));
            fs.mkdirSync(path.join(root, 'BASE', 'A'));
            fs.mkdirSync(path.join(root, 'BASE', 'B'));
            fs.mkdirSync(path.join(root, 'BASE', 'C'));
            const git = await createGit();
            await initRepository(path.join(root, 'BASE'));
            await initRepository(path.join(root, 'BASE', 'A'));
            await initRepository(path.join(root, 'BASE', 'B'));
            await initRepository(path.join(root, 'BASE', 'C'));
            const workspaceRootUri = FileUri.create(path.join(root, 'BASE')).toString();
            const repositories = await git.repositories(workspaceRootUri, {});
            expect(repositories.map(r => path.basename(FileUri.fsPath(r.localUri))).sort()).to.deep.equal(['A', 'B', 'BASE', 'C']);

        });

        it('should discover all nested repositories and the container repository', async () => {

            const root = track.mkdirSync('discovery-test-4');
            fs.mkdirSync(path.join(root, 'BASE'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT', 'A'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT', 'B'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT', 'C'));
            const git = await createGit();
            await initRepository(path.join(root, 'BASE'));
            await initRepository(path.join(root, 'BASE', 'WS_ROOT', 'A'));
            await initRepository(path.join(root, 'BASE', 'WS_ROOT', 'B'));
            await initRepository(path.join(root, 'BASE', 'WS_ROOT', 'C'));
            const workspaceRootUri = FileUri.create(path.join(root, 'BASE', 'WS_ROOT')).toString();
            const repositories = await git.repositories(workspaceRootUri, {});
            const repositoryNames = repositories.map(r => path.basename(FileUri.fsPath(r.localUri)));
            expect(repositoryNames.shift()).to.equal('BASE'); // The first must be the container repository.
            expect(repositoryNames.sort()).to.deep.equal(['A', 'B', 'C']);

        });

    });

    describe('status', async () => {

        it('modifying a staged file should result in two changes', async () => {

            // Init repository.
            const root = await createTestRepository(track.mkdirSync('status-test'));
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };
            const git = await createGit();

            // // Check status. Expect empty.
            let status = await git.status(repository);
            expect(status.changes).to.be.empty;

            // Modify a file.
            const filePath = path.join(root, 'A.txt');
            const fileUri = FileUri.create(filePath).toString();
            fs.writeFileSync(filePath, 'new content');
            expect(fs.readFileSync(filePath, { encoding: 'utf8' })).to.be.equal('new content');
            await git.add(repository, fileUri);

            // Check the status again. Expect one single change.
            status = await git.status(repository);
            expect(status.changes).to.have.lengthOf(1);
            expect(status.changes[0].uri).to.be.equal(fileUri);
            expect(status.changes[0].staged).to.be.true;

            // Change the same file again.
            fs.writeFileSync(filePath, 'yet another new content');
            expect(fs.readFileSync(filePath, { encoding: 'utf8' })).to.be.equal('yet another new content');

            // We expect two changes; one is staged, the other is in the working directory.
            status = await git.status(repository);
            expect(status.changes).to.have.lengthOf(2);
            expect(status.changes.map(f => f.uri)).to.be.deep.equal([fileUri, fileUri]);
            expect(status.changes.map(f => f.staged).sort()).to.be.deep.equal([false, true]);

        });

        it('adding, staging, then deleting a file should result in two changes', async () => {

            // Init repository.
            const root = await createTestRepository(track.mkdirSync('status-test'));
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };
            const git = await createGit();

            // Create a new file.
            const filePath = path.join(root, 'D.txt');
            const fileUri = FileUri.create(filePath).toString();
            fs.writeFileSync(filePath, 'new content');
            await git.add(repository, fileUri);

            // Delete the file
            await fs.unlink(filePath);

            // We expect two changes; one is staged, the other is in the working directory.
            const status = await git.status(repository);
            expect(status.changes).to.have.deep.members([
                {
                    uri: fileUri,
                    staged: true,
                    status: GitFileStatus.New
                },
                {
                    uri: fileUri,
                    staged: false,
                    status: GitFileStatus.Deleted
                }
            ]);
        });

        it('adding, staging, then modifying a file should result in two changes', async () => {

            // Init repository.
            const root = await createTestRepository(track.mkdirSync('status-test'));
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };
            const git = await createGit();

            // Create a new file.
            const filePath = path.join(root, 'D.txt');
            const fileUri = FileUri.create(filePath).toString();
            fs.writeFileSync(filePath, 'initial content');
            await git.add(repository, fileUri);

            // Modify the file
            fs.writeFileSync(filePath, 'new content');

            // We expect two changes; one is staged, the other is in the working directory.
            const status = await git.status(repository);
            expect(status.changes).to.have.deep.members([
                {
                    uri: fileUri,
                    staged: true,
                    status: GitFileStatus.New
                },
                {
                    uri: fileUri,
                    staged: false,
                    status: GitFileStatus.Modified
                }
            ]);
        });

    });

    describe('WorkingDirectoryStatus#equals', async () => {

        it('staged change should matter', async () => {

            const left: WorkingDirectoryStatus = JSON.parse(`
            {
                "exists":true,
                "branch":"GH-165",
                "upstreamBranch":"origin/GH-165",
                "aheadBehind":{
                   "ahead":0,
                   "behind":0
                },
                "changes":[
                   {
                      "uri":"bar.foo",
                      "status":0,
                      "staged":false
                   }
                ],
                "currentHead":"a274d43dbfba5d1ff9d52db42dc90c6f03071656"
             }
            `);

            const right: WorkingDirectoryStatus = JSON.parse(`
            {
                "exists":true,
                "branch":"GH-165",
                "upstreamBranch":"origin/GH-165",
                "aheadBehind":{
                   "ahead":0,
                   "behind":0
                },
                "changes":[
                   {
                      "uri":"bar.foo",
                      "status":0,
                      "staged":true
                   }
                ],
                "currentHead":"a274d43dbfba5d1ff9d52db42dc90c6f03071656"
             }
            `);

            expect(WorkingDirectoryStatus.equals(left, right)).to.be.false;

        });

    });

    describe('show', async () => {

        let repository: Repository | undefined;
        let git: Git | undefined;

        beforeEach(async () => {
            const root = await createTestRepository(track.mkdirSync('status-test'));
            const localUri = FileUri.create(root).toString();
            repository = { localUri };
            git = await createGit();
        });

        it('modified in working directory', async () => {
            const repositoryPath = FileUri.fsPath(repository!.localUri);
            fs.writeFileSync(path.join(repositoryPath, 'A.txt'), 'new content');
            expect(fs.readFileSync(path.join(repositoryPath, 'A.txt'), { encoding: 'utf8' })).to.be.equal('new content');
            const content = await git!.show(repository!, FileUri.create(path.join(repositoryPath, 'A.txt')).toString(), { commitish: 'HEAD' });
            expect(content).to.be.equal('A');
        });

        it('modified in working directory (nested)', async () => {
            const repositoryPath = FileUri.fsPath(repository!.localUri);
            fs.writeFileSync(path.join(repositoryPath, 'folder', 'C.txt'), 'new content');
            expect(fs.readFileSync(path.join(repositoryPath, 'folder', 'C.txt'), { encoding: 'utf8' })).to.be.equal('new content');
            const content = await git!.show(repository!, FileUri.create(path.join(repositoryPath, 'folder', 'C.txt')).toString(), { commitish: 'HEAD' });
            expect(content).to.be.equal('C');
        });

        it('modified in index', async () => {
            const repositoryPath = FileUri.fsPath(repository!.localUri);
            fs.writeFileSync(path.join(repositoryPath, 'A.txt'), 'new content');
            expect(fs.readFileSync(path.join(repositoryPath, 'A.txt'), { encoding: 'utf8' })).to.be.equal('new content');
            await git!.add(repository!, FileUri.create(path.join(repositoryPath, 'A.txt')).toString());
            const content = await git!.show(repository!, FileUri.create(path.join(repositoryPath, 'A.txt')).toString(), { commitish: 'index' });
            expect(content).to.be.equal('new content');
        });

        it('modified in index and in working directory', async () => {
            const repositoryPath = FileUri.fsPath(repository!.localUri);
            fs.writeFileSync(path.join(repositoryPath, 'A.txt'), 'new content');
            expect(fs.readFileSync(path.join(repositoryPath, 'A.txt'), { encoding: 'utf8' })).to.be.equal('new content');
            await git!.add(repository!, FileUri.create(path.join(repositoryPath, 'A.txt')).toString());
            expect(await git!.show(repository!, FileUri.create(path.join(repositoryPath, 'A.txt')).toString(), { commitish: 'index' })).to.be.equal('new content');
            expect(await git!.show(repository!, FileUri.create(path.join(repositoryPath, 'A.txt')).toString(), { commitish: 'HEAD' })).to.be.equal('A');
        });

    });

    describe('remote', async () => {

        it('remotes are not set by default', async () => {
            const root = track.mkdirSync('remote-with-init');
            const localUri = FileUri.create(root).toString();
            await initRepository(root);
            const git = await createGit();
            const remotes = await git.remote({ localUri });
            expect(remotes).to.be.empty;
        });

        it('origin is the default after a fresh clone', async () => {
            const git = await createGit();
            const remoteUrl = 'https://github.com/TypeFox/find-git-exec.git';
            const localUri = FileUri.create(track.mkdirSync('remote-with-clone')).toString();
            const options = { localUri };
            await git.clone(remoteUrl, options);

            const remotes = await git.remote({ localUri });
            expect(remotes).to.be.lengthOf(1);
            expect(remotes.shift()).to.be.equal('origin');
        });

        it('remotes can be added and queried', async () => {
            const root = track.mkdirSync('remote-with-init');
            const localUri = FileUri.create(root).toString();
            await initRepository(root);

            await gitExec(['remote', 'add', 'first', 'some/location'], root, 'addRemote');
            await gitExec(['remote', 'add', 'second', 'some/location'], root, 'addRemote');

            const git = await createGit();
            const remotes = await git.remote({ localUri });
            expect(remotes).to.be.deep.equal(['first', 'second']);
        });

    });

    describe('exec', async () => {

        it('version', async () => {
            const root = track.mkdirSync('exec-version');
            const localUri = FileUri.create(root).toString();
            await initRepository(root);

            const git = await createGit();
            const result = await git.exec({ localUri }, ['--version']);
            expect(result.stdout.trim().replace(/^git version /, '').startsWith('2')).to.be.true;
            expect(result.stderr.trim()).to.be.empty;
            expect(result.exitCode).to.be.equal(0);
        });

        it('config', async () => {
            const root = track.mkdirSync('exec-config');
            const localUri = FileUri.create(root).toString();
            await initRepository(root);

            const git = await createGit();
            const result = await git.exec({ localUri }, ['config', '-l']);
            expect(result.stdout.trim()).to.be.not.empty;
            expect(result.stderr.trim()).to.be.empty;
            expect(result.exitCode).to.be.equal(0);
        });

    });

    describe('map-status', async () => {

        it('deleted', () => {
            expect(GitUtils.mapStatus('D')).to.be.equal(GitFileStatus.Deleted);
        });

        it('added with leading whitespace', () => {
            expect(GitUtils.mapStatus(' A')).to.be.equal(GitFileStatus.New);
        });

        it('modified with trailing whitespace', () => {
            expect(GitUtils.mapStatus('M ')).to.be.equal(GitFileStatus.Modified);
        });

        it('copied with percentage', () => {
            expect(GitUtils.mapStatus('C100')).to.be.equal(GitFileStatus.Copied);
        });

        it('renamed with percentage', () => {
            expect(GitUtils.mapStatus('R10')).to.be.equal(GitFileStatus.Renamed);
        });

    });

    describe('similarity-status', async () => {

        it('copied (2)', () => {
            expect(GitUtils.isSimilarityStatus('C2')).to.be.false;
        });

        it('copied (20)', () => {
            expect(GitUtils.isSimilarityStatus('C20')).to.be.false;
        });

        it('copied (020)', () => {
            expect(GitUtils.isSimilarityStatus('C020')).to.be.true;
        });

        it('renamed (2)', () => {
            expect(GitUtils.isSimilarityStatus('R2')).to.be.false;
        });

        it('renamed (20)', () => {
            expect(GitUtils.isSimilarityStatus('R20')).to.be.false;
        });

        it('renamed (020)', () => {
            expect(GitUtils.isSimilarityStatus('R020')).to.be.true;
        });

        it('invalid', () => {
            expect(GitUtils.isSimilarityStatus('invalid')).to.be.false;
        });

    });

    describe('blame', async () => {

        const init = async (git: Git, repository: Repository) => {
            await git.exec(repository, ['init']);
            if ((await git.exec(repository, ['config', 'user.name'], { successExitCodes: [0, 1] })).exitCode !== 0) {
                await git.exec(repository, ['config', 'user.name', 'User Name']);
            }
            if ((await git.exec(repository, ['config', 'user.email'], { successExitCodes: [0, 1] })).exitCode !== 0) {
                await git.exec(repository, ['config', 'user.email', 'user.name@domain.com']);
            }
        };

        it('blame file with dirty content', async () => {
            const fileName = 'blame.me.not';
            const root = track.mkdirSync('blame-dirty-file');
            const filePath = path.join(root, fileName);
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };

            const writeContentLines = async (lines: string[]) => fs.writeFile(filePath, lines.join('\n'), { encoding: 'utf8' });
            const addAndCommit = async (message: string) => {
                await git.exec(repository, ['add', '.']);
                await git.exec(repository, ['commit', '-m', `${message}`]);
            };
            const expectBlame = async (content: string, expected: [number, string][]) => {
                const uri = FileUri.create(path.join(root, fileName)).toString();
                const actual = await git.blame(repository, uri, { content });
                expect(actual).to.be.not.undefined;
                const messages = new Map(actual!.commits.map<[string, string]>(c => [c.sha, c.summary]));
                const lineMessages = actual!.lines.map(l => [l.line, messages.get(l.sha)]);
                expect(lineMessages).to.be.deep.equal(expected);
            };

            const git = await createGit();
            await init(git, repository);
            await fs.createFile(filePath);

            await writeContentLines(['🍏', '🍏', '🍏', '🍏', '🍏', '🍏']);
            await addAndCommit('six 🍏');

            await expectBlame(['🍏', '🍐', '🍐', '🍏', '🍏', '🍏'].join('\n'),
                [
                    [0, 'six 🍏'],
                    [1, 'uncommitted'],
                    [2, 'uncommitted'],
                    [3, 'six 🍏'],
                    [4, 'six 🍏'],
                    [5, 'six 🍏'],
                ]);
        });

        it('uncommitted file', async () => {
            const fileName = 'uncommitted.file';
            const root = track.mkdirSync('try-blame');
            const filePath = path.join(root, fileName);
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };

            const writeContentLines = async (lines: string[]) => fs.writeFile(filePath, lines.join('\n'), { encoding: 'utf8' });
            const addToIndex = async () => {
                // await git.add(repository, FileUri.create(filePath).toString().toString());
                await git.exec(repository, ['add', '.']);
            };
            const expectUndefinedBlame = async () => {
                const uri = FileUri.create(path.join(root, fileName)).toString();
                const actual = await git.blame(repository, uri);
                expect(actual).to.be.undefined;
            };

            const git = await createGit();
            await init(git, repository);
            await fs.createFile(filePath);

            await writeContentLines(['🍏', '🍏', '🍏', '🍏', '🍏', '🍏']);
            await expectUndefinedBlame();

            await addToIndex();
            await expectUndefinedBlame();

            await writeContentLines(['🍏', '🍐', '🍐', '🍏', '🍏', '🍏']);
            await expectUndefinedBlame();
        });

        it('blame file', async () => {
            const fileName = 'blame.me';
            const root = track.mkdirSync('blame-file');
            const filePath = path.join(root, fileName);
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };

            const writeContentLines = async (lines: string[]) => fs.writeFile(filePath, lines.join('\n'), { encoding: 'utf8' });
            const addAndCommit = async (message: string) => {
                await git.exec(repository, ['add', '.']);
                await git.exec(repository, ['commit', '-m', `${message}`]);
            };
            const expectBlame = async (expected: [number, string][]) => {
                const uri = FileUri.create(path.join(root, fileName)).toString();
                const actual = await git.blame(repository, uri);
                expect(actual).to.be.not.undefined;
                const messages = new Map(actual!.commits.map<[string, string]>(c => [c.sha, c.summary]));
                const lineMessages = actual!.lines.map(l => [l.line, messages.get(l.sha)]);
                expect(lineMessages).to.be.deep.equal(expected);
            };

            const git = await createGit();
            await init(git, repository);
            await fs.createFile(filePath);

            await writeContentLines(['🍏', '🍏', '🍏', '🍏', '🍏', '🍏']);
            await addAndCommit('six 🍏');

            await writeContentLines(['🍏', '🍐', '🍐', '🍏', '🍏', '🍏']);
            await addAndCommit('replace two with 🍐');

            await writeContentLines(['🍏', '🍐', '🍋', '🍋', '🍏', '🍏']);
            await addAndCommit('replace two with 🍋');

            await writeContentLines(['🍏', '🍐', '🍋', '🍌', '🍌', '🍏']);

            await expectBlame([
                [0, 'six 🍏'],
                [1, 'replace two with 🍐'],
                [2, 'replace two with 🍋'],
                [3, 'uncommitted'],
                [4, 'uncommitted'],
                [5, 'six 🍏'],
            ]);
        });

        it('commit summary and body', async () => {
            const fileName = 'blame.me';
            const root = track.mkdirSync('blame-with-commit-body');
            const filePath = path.join(root, fileName);
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };

            const writeContentLines = async (lines: string[]) => fs.writeFile(filePath, lines.join('\n'), { encoding: 'utf8' });
            const addAndCommit = async (message: string) => {
                await git.exec(repository, ['add', '.']);
                await git.exec(repository, ['commit', '-m', `${message}`]);
            };
            const expectBlame = async (expected: [number, string, string][]) => {
                const uri = FileUri.create(path.join(root, fileName)).toString();
                const actual = await git.blame(repository, uri);
                expect(actual).to.be.not.undefined;
                const messages = new Map(actual!.commits.map<[string, string[]]>(c => [c.sha, [c.summary, c.body!]]));
                const lineMessages = actual!.lines.map(l => [l.line, ...messages.get(l.sha)!]);
                expect(lineMessages).to.be.deep.equal(expected);
            };

            const git = await createGit();
            await init(git, repository);
            await fs.createFile(filePath);

            await writeContentLines(['🍏']);
            await addAndCommit('add 🍏\n* green\n* red');

            await expectBlame([
                [0, 'add 🍏', '* green\n* red']
            ]);
        });
    });

    describe('diff', async () => {
        const init = async (git: Git, repository: Repository) => {
            await git.exec(repository, ['init']);
            if ((await git.exec(repository, ['config', 'user.name'], { successExitCodes: [0, 1] })).exitCode !== 0) {
                await git.exec(repository, ['config', 'user.name', 'User Name']);
            }
            if ((await git.exec(repository, ['config', 'user.email'], { successExitCodes: [0, 1] })).exitCode !== 0) {
                await git.exec(repository, ['config', 'user.email', 'user.name@domain.com']);
            }
        };

        it('diff without ranges / unstaged', async () => {
            const root = track.mkdirSync('diff-without-ranges');
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };
            await fs.createFile(path.join(root, 'A.txt'));
            await fs.writeFile(path.join(root, 'A.txt'), 'A content', { encoding: 'utf8' });
            const git = await createGit();

            await init(git, repository);

            const expectDiff: (expected: ChangeDelta[]) => Promise<void> = async expected => {
                const actual = (await git.diff(repository)).map(change => ChangeDelta.map(repository, change)).sort(ChangeDelta.compare);
                expect(actual).to.be.deep.equal(expected);
            };

            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Initialized."']); // HEAD

            await fs.createFile(path.join(root, 'B.txt'));
            await fs.writeFile(path.join(root, 'B.txt'), 'B content', { encoding: 'utf8' });
            await expectDiff([]); // Unstaged (new)

            await fs.writeFile(path.join(root, 'A.txt'), 'updated A content', { encoding: 'utf8' });
            await expectDiff([{ pathSegment: 'A.txt', status: GitFileStatus.Modified }]); // Unstaged (modified)

            await fs.unlink(path.join(root, 'A.txt'));
            await expectDiff([{ pathSegment: 'A.txt', status: GitFileStatus.Deleted }]); // Unstaged (deleted)
        });

        it('diff without ranges / staged', async () => {
            const root = track.mkdirSync('diff-without-ranges');
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };
            await fs.createFile(path.join(root, 'A.txt'));
            await fs.writeFile(path.join(root, 'A.txt'), 'A content', { encoding: 'utf8' });
            const git = await createGit();

            await init(git, repository);

            const expectDiff: (expected: ChangeDelta[]) => Promise<void> = async expected => {
                const actual = (await git.diff(repository)).map(change => ChangeDelta.map(repository, change)).sort(ChangeDelta.compare);
                expect(actual).to.be.deep.equal(expected);
            };

            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Initialized."']); // HEAD

            await fs.createFile(path.join(root, 'B.txt'));
            await fs.writeFile(path.join(root, 'B.txt'), 'B content', { encoding: 'utf8' });
            await git.add(repository, FileUri.create(path.join(root, 'B.txt')).toString());
            await expectDiff([{ pathSegment: 'B.txt', status: GitFileStatus.New }]); // Staged (new)

            await fs.writeFile(path.join(root, 'A.txt'), 'updated A content', { encoding: 'utf8' });
            await git.add(repository, FileUri.create(path.join(root, 'A.txt')).toString());
            await expectDiff([{ pathSegment: 'A.txt', status: GitFileStatus.Modified }, { pathSegment: 'B.txt', status: GitFileStatus.New }]); // Staged (modified)

            await fs.unlink(path.join(root, 'A.txt'));
            await git.add(repository, FileUri.create(path.join(root, 'A.txt')).toString());
            await expectDiff([{ pathSegment: 'A.txt', status: GitFileStatus.Deleted }, { pathSegment: 'B.txt', status: GitFileStatus.New }]); // Staged (deleted)
        });

        it('diff with ranges', async () => {
            const root = track.mkdirSync('diff-with-ranges');
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };
            await fs.createFile(path.join(root, 'A.txt'));
            await fs.writeFile(path.join(root, 'A.txt'), 'A content', { encoding: 'utf8' });
            await fs.createFile(path.join(root, 'B.txt'));
            await fs.writeFile(path.join(root, 'B.txt'), 'B content', { encoding: 'utf8' });
            await fs.mkdir(path.join(root, 'folder'));
            await fs.createFile(path.join(root, 'folder', 'F1.txt'));
            await fs.writeFile(path.join(root, 'folder', 'F1.txt'), 'F1 content', { encoding: 'utf8' });
            await fs.createFile(path.join(root, 'folder', 'F2.txt'));
            await fs.writeFile(path.join(root, 'folder', 'F2.txt'), 'F2 content', { encoding: 'utf8' });
            const git = await createGit();

            await init(git, repository);

            const expectDiff: (fromRevision: string, toRevision: string, expected: ChangeDelta[], filePath?: string) => Promise<void> = async (fromRevision, toRevision, expected, filePath) => {
                const range = { fromRevision, toRevision };
                let uri: string | undefined;
                if (filePath) {
                    uri = FileUri.create(path.join(root, filePath)).toString();
                }
                const options: Git.Options.Diff = { range, uri };
                const actual = (await git.diff(repository, options)).map(change => ChangeDelta.map(repository, change)).sort(ChangeDelta.compare);
                expect(actual).to.be.deep.equal(expected, `Between ${fromRevision}..${toRevision}`);
            };

            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 1 on master."']); // HEAD~4

            await git.exec(repository, ['checkout', '-b', 'new-branch']);
            await fs.writeFile(path.join(root, 'A.txt'), 'updated A content', { encoding: 'utf8' });
            await fs.unlink(path.join(root, 'B.txt'));
            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 1 on new-branch."']); // new-branch~2

            await fs.createFile(path.join(root, 'C.txt'));
            await fs.writeFile(path.join(root, 'C.txt'), 'C content', { encoding: 'utf8' });
            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 2 on new-branch."']); // new-branch~1

            await fs.createFile(path.join(root, 'B.txt'));
            await fs.writeFile(path.join(root, 'B.txt'), 'B content', { encoding: 'utf8' });
            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 3 on new-branch."']); // new-branch

            await git.exec(repository, ['checkout', 'master']);

            await fs.createFile(path.join(root, 'C.txt'));
            await fs.writeFile(path.join(root, 'C.txt'), 'C content', { encoding: 'utf8' });
            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 2 on master."']); // HEAD~3

            await fs.createFile(path.join(root, 'D.txt'));
            await fs.writeFile(path.join(root, 'D.txt'), 'D content', { encoding: 'utf8' });
            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 3 on master."']); // HEAD~2

            await fs.unlink(path.join(root, 'B.txt'));
            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 4 on master."']); // HEAD~1

            await fs.unlink(path.join(root, 'folder', 'F1.txt'));
            await fs.writeFile(path.join(root, 'folder', 'F2.txt'), 'updated F2 content', { encoding: 'utf8' });
            await fs.createFile(path.join(root, 'folder', 'F3 with space.txt'));
            await fs.writeFile(path.join(root, 'folder', 'F3 with space.txt'), 'F3 content', { encoding: 'utf8' });
            await git.exec(repository, ['add', '.']);
            await git.exec(repository, ['commit', '-m', '"Commit 5 on master."']); // HEAD

            await expectDiff('HEAD~4', 'HEAD~3', [{ pathSegment: 'C.txt', status: GitFileStatus.New }]);
            await expectDiff('HEAD~4', 'HEAD~2', [{ pathSegment: 'C.txt', status: GitFileStatus.New }, { pathSegment: 'D.txt', status: GitFileStatus.New }]);
            await expectDiff('HEAD~4', 'HEAD~1', [{ pathSegment: 'B.txt', status: GitFileStatus.Deleted }, { pathSegment: 'C.txt', status: GitFileStatus.New }, { pathSegment: 'D.txt', status: GitFileStatus.New }]);
            await expectDiff('HEAD~3', 'HEAD~2', [{ pathSegment: 'D.txt', status: GitFileStatus.New }]);
            await expectDiff('HEAD~3', 'HEAD~1', [{ pathSegment: 'B.txt', status: GitFileStatus.Deleted }, { pathSegment: 'D.txt', status: GitFileStatus.New }]);
            await expectDiff('HEAD~2', 'HEAD~1', [{ pathSegment: 'B.txt', status: GitFileStatus.Deleted }]);

            await expectDiff('new-branch~2', 'new-branch~1', [{ pathSegment: 'C.txt', status: GitFileStatus.New }]);
            await expectDiff('new-branch~2', 'new-branch', [{ pathSegment: 'B.txt', status: GitFileStatus.New }, { pathSegment: 'C.txt', status: GitFileStatus.New }]);
            await expectDiff('new-branch~1', 'new-branch', [{ pathSegment: 'B.txt', status: GitFileStatus.New }]);

            // Filter for a whole folder and its descendants.
            await expectDiff('HEAD~4', 'HEAD~3', [], 'folder');
            await expectDiff('HEAD~4', 'HEAD', [
                { pathSegment: 'folder/F1.txt', status: GitFileStatus.Deleted },
                { pathSegment: 'folder/F2.txt', status: GitFileStatus.Modified },
                { pathSegment: 'folder/F3 with space.txt', status: GitFileStatus.New },
            ], 'folder');

            // Filter for a single file.
            await expectDiff('HEAD~4', 'HEAD~3', [], 'folder/F1.txt');
            await expectDiff('HEAD~4', 'HEAD', [
                { pathSegment: 'folder/F1.txt', status: GitFileStatus.Deleted },
            ], 'folder/F1.txt');

            // Filter for a non-existing file.
            await expectDiff('HEAD~4', 'HEAD~3', [], 'does not exist');
            await expectDiff('HEAD~4', 'HEAD', [], 'does not exist');
        });

    });

    describe('branch', () => {

        // Skip the test case as it is dependent on the git version.
        it.skip('should list the branch in chronological order', async function (): Promise<void> {
            if (isWindows) {
                this.skip(); // https://github.com/eclipse-theia/theia/issues/8023
                return;
            }
            const root = track.mkdirSync('branch-order');
            const localUri = FileUri.create(root).toString();
            const repository = { localUri };
            const git = await createGit();

            await createTestRepository(root);
            await git.exec(repository, ['checkout', '-b', 'a']);
            await git.exec(repository, ['checkout', 'master']);
            await git.exec(repository, ['checkout', '-b', 'b']);
            await git.exec(repository, ['checkout', 'master']);
            await git.exec(repository, ['checkout', '-b', 'c']);
            await git.exec(repository, ['checkout', 'master']);

            expect((await git.branch(repository, { type: 'local' })).map(b => b.nameWithoutRemote)).to.be.deep.equal(['master', 'c', 'b', 'a']);
        });

    });

    describe('ls-files', () => {

        let git: Git;
        let root: string;
        let localUri: string;

        before(async () => {
            root = track.mkdirSync('ls-files');
            localUri = FileUri.create(root).toString();
            git = await createGit();
            await createTestRepository(root);
        });

        ([
            ['A.txt', true],
            ['missing.txt', false],
            ['../outside.txt', false],
        ] as [string, boolean][]).forEach(test => {
            const [relativePath, expectation] = test;
            const message = `${expectation ? '' : 'not '}exist`;
            it(`errorUnmatched - ${relativePath} should ${message}`, async () => {
                const uri = relativePath.startsWith('.') ? relativePath : FileUri.create(path.join(root, relativePath)).toString();
                const testMe = async () => git.lsFiles({ localUri }, uri, { errorUnmatch: true });
                expect(await testMe()).to.be.equal(expectation);
            });
        });

    });

});

describe('log', function (): void {

    // See https://github.com/eclipse-theia/theia/issues/2143
    it('should not fail when executed from the repository root', async () => {
        const git = await createGit();
        const root = await createTestRepository(track.mkdirSync('log-test'));
        const localUri = FileUri.create(root).toString();
        const repository = { localUri };
        const result = await git.log(repository, { uri: localUri });
        expect(result.length).to.be.equal(1);
        expect(result[0].author.email).to.be.equal('jon@doe.com');
    });

    it('should not fail when executed against an empty repository', async () => {
        const git = await createGit();
        const root = await initRepository(track.mkdirSync('empty-log-test'));
        const localUri = FileUri.create(root).toString();
        const repository = { localUri };
        const result = await git.log(repository, { uri: localUri });
        expect(result.length).to.be.equal(0);
    });
});

function toPathSegment(repository: Repository, uri: string): string {
    return upath.relative(FileUri.fsPath(repository.localUri), FileUri.fsPath(uri));
}

/**
 * Initializes a new Git repository to the destination folder. On demand, creates the desired folder structure and commits the changes.
 *
 * @param repositoryPath the desired destination folder for the new Git repository.
 * @param addToIndex `true` if all the repository content has to be added to the index.
 * @param commit `true` if the directory structure has to be committed.
 */
async function initRepository(repositoryPath: string, addToIndex?: boolean, commit?: boolean): Promise<string> {
    if ((await gitExec(['init'], repositoryPath, 'init')).exitCode !== 0) {
        throw new Error(`Error while initializing a repository under ${repositoryPath}.`);
    }
    if ((await gitExec(['config', 'user.email', '"jon@doe.com"'], repositoryPath, 'config')).exitCode !== 0) {
        throw new Error('Error while setting user email to the Git configuration.');
    }
    if ((await gitExec(['config', 'user.name', '"Jon Doe"'], repositoryPath, 'config')).exitCode !== 0) {
        throw new Error('Error while setting user name to the Git configuration.');
    }
    // To make sure we have `\n` as the line ending on both Windows and *NIX when asserting the tests.
    // Otherwise, a `git checkout-index -u` will convert `\n` to `\r\n` on Windows.
    if ((await gitExec(['config', 'core.autocrlf', 'false'], repositoryPath, 'config')).exitCode !== 0) {
        throw new Error('Error while adjusting core.autocrlf in the Git configuration.');
    }
    if (addToIndex) {
        if ((await gitExec(['add', '.'], repositoryPath, 'add')).exitCode !== 0) {
            throw new Error('Error while staging changes into the repository.');
        }
        if (commit) {
            if ((await gitExec(['commit', '-F', '-'], repositoryPath, 'createCommit', { stdin: 'Initial commit.' })).exitCode !== 0) {
                throw new Error('Error while committing changes into the repository');
            }
        }
    }
    return repositoryPath;
}

async function createTestRepository(root: string): Promise<string> {
    fs.mkdirSync(path.join(root, 'folder'));
    fs.writeFileSync(path.join(root, 'A.txt'), 'A', { encoding: 'utf8' });
    fs.writeFileSync(path.join(root, 'B.txt'), 'B', { encoding: 'utf8' });
    fs.writeFileSync(path.join(root, 'folder', 'C.txt'), 'C', { encoding: 'utf8' });
    await initRepository(root, true, true);
    return root;
}

export async function usesLocalGit(): Promise<boolean> {
    return process.env.USE_LOCAL_GIT === 'true';
}

export function remove(repositoryPath: string, filesToDelete: string | string[]): string[] {
    const files = (Array.isArray(filesToDelete) ? filesToDelete : [filesToDelete]).map(f => path.join(repositoryPath, f));
    for (const f of files) {
        if (!fs.existsSync(f)) {
            throw new Error(`Cannot delete file ${f}, it does not exist.`);
        }
        if (!fs.statSync(f).isFile()) {
            throw new Error(`Only files can be deleted, directories not: ${f}.`);
        }
        fs.unlinkSync(f);
        if (fs.existsSync(f)) {
            throw new Error(`Cannot delete file: ${f}.`);
        }
    }
    return files;
}

export function add(repositoryPath: string, filesToCreate: { path: string, data?: string } | { path: string, data?: string }[]): string[] {
    const files = (Array.isArray(filesToCreate) ? filesToCreate : [filesToCreate])
        .map(f => ({ path: path.join(repositoryPath, f.path), data: f.data || '' }));
    for (const f of files) {
        if (fs.existsSync(f.path)) {
            throw new Error(`File ${f.path}, already exists.`);
        }
        fs.writeFileSync(f.path, f.data);
        if (!fs.existsSync(f.path)) {
            throw new Error(`Cannot create new file: ${f.path}.`);
        }
    }
    return files.map(f => f.path);
}

export function modify(repositoryPath: string, filesToModify: { path: string, data: string } | { path: string, data: string }[]): string[] {
    const files = (Array.isArray(filesToModify) ? filesToModify : [filesToModify])
        .map(f => ({ path: path.join(repositoryPath, f.path), data: f.data }));
    for (const f of files) {
        if (!fs.existsSync(f.path)) {
            throw new Error(`Cannot modify the content of the file ${f.path}, it does not exist.`);
        }
        if (!fs.statSync(f.path).isFile()) {
            throw new Error(`Only files can be modified, directories not: ${f.path}.`);
        }
        fs.writeFileSync(f.path, f.data);
        if (!fs.existsSync(f.path) || fs.readFileSync(f.path, 'utf-8') !== f.data) {
            throw new Error(`Cannot modify the file content file: ${f.path}.`);
        }
    }
    return files.map(f => f.path);
}

export function rename(repositoryPath: string, filesToRename: { oldPath: string, newPath: string } | { oldPath: string, newPath: string }[]): string[] {
    const files = (Array.isArray(filesToRename) ? filesToRename : [filesToRename])
        .map(f => ({ oldPath: path.join(repositoryPath, f.oldPath), newPath: path.join(repositoryPath, f.newPath) }));
    for (const f of files) {
        if (!fs.existsSync(f.oldPath)) {
            throw new Error(`Cannot rename the file ${f.oldPath}, it does not exist.`);
        }
        if (fs.existsSync(f.newPath)) {
            throw new Error(`Cannot rename the file ${f.oldPath}, a file already exists in the destination: ${f.newPath}.`);
        }
        if (!fs.statSync(f.oldPath).isFile()) {
            throw new Error(`Only files can be renamed, directories not: ${f.oldPath}.`);
        }
        fs.renameSync(f.oldPath, f.newPath);
        if (!fs.existsSync(f.newPath) || fs.existsSync(f.oldPath)) {
            throw new Error(`Cannot rename file: ${f.oldPath} -> ${f.newPath}.`);
        }
    }
    return [...files.map(f => f.oldPath), ...files.map(f => f.newPath)];
}

export function contentIsEqual(repositoryPath: string, fileNameOrPath: string, content: string): boolean {
    const fileContent = fs.readFileSync(path.join(repositoryPath, fileNameOrPath), { encoding: 'utf8' });
    return fileContent === content;
}

interface ChangeDelta {
    readonly pathSegment: string;
    readonly status: GitFileStatus;
}

namespace ChangeDelta {
    export function compare(left: ChangeDelta, right: ChangeDelta): number {
        const result = left.pathSegment.localeCompare(right.pathSegment);
        if (result === 0) {
            return left.status - right.status;
        }
        return result;
    }
    export function map(repository: Repository, fileChange: GitFileChange): ChangeDelta {
        return {
            pathSegment: toPathSegment(repository, fileChange.uri),
            status: fileChange.status
        };
    }
}
