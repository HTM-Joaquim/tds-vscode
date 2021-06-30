/*
Copyright 2021 TOTVS S.A

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http: //www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import * as vscode from 'vscode';
import * as fs from 'fs';
import path = require('path');
import Utils from './utils';

const relativePattern = new vscode.RelativePattern(
  vscode.workspace.workspaceFolders[0],
  '*.ts'
);

class ServerJsonFileWatcher {
  private watchers: Map<string, vscode.FileSystemWatcher> = new Map<string, vscode.FileSystemWatcher>();

  removeFile(target: string) {
    const folder: string = target.substr(0, target.lastIndexOf(path.sep));

    this.watchers.delete(folder);
  }

  addFile(target: string, listener: any) {
    const folder: string = target.substr(0, target.lastIndexOf(path.sep));
    const file: string = target.substr(target.lastIndexOf(path.sep) + 1);

    const pattern: vscode.RelativePattern = new vscode.RelativePattern(
      folder,
      file
    );
    const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      pattern
    );
    watcher.onDidChange(listener);
    watcher.onDidCreate(listener);
    watcher.onDidDelete(listener);

    this.watchers.set(folder, watcher);
  }
}

export const serverJsonFileWatcher: ServerJsonFileWatcher = new ServerJsonFileWatcher();
