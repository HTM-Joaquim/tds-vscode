import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { TDSConfiguration } from './configurations';
import { IRpoToken } from './rpoToken';
import {
  EventData,
  ICompileKey,
  IServerDebugger,
  IServerManager,
  serverManager,
} from './serverManager';

const localize = nls.config({
  locale: vscode.env.language,
  bundleFormat: nls.BundleFormat.standalone,
})();

let currentServerBarItem: vscode.StatusBarItem;
let saveLocationBarItem: vscode.StatusBarItem;
let permissionStatusBarItem: vscode.StatusBarItem;
let settingsStatusBarItem: vscode.StatusBarItem;
let rpoTokenStatusBarItem: vscode.StatusBarItem;

const priorityTotvsStatusBarItem: number = 103;
const priorityRpoTokenStatusBarItem: number = 102;
const priorityPermissionStatusBarItem: number = 101;
const prioritySettingsStatusBarItem: number = 100;

export function initStatusBarItems(context: vscode.ExtensionContext) {
  initStatusBarItem(context);
  initPermissionStatusBarItem(context);
  initRpoTokenStatusBarItem(context);
  initSettingsBarItem(context);
}

// function updateStatusBarItems() {
//   updateStatusBarItem(undefined);
//   updateSaveLocationBarItem();
//   updatePermissionStatusBarItem();
//   updateRpoTokenStatusBarItem();
//   updateSettingsBarItem();
// }

function initStatusBarItem(context: vscode.ExtensionContext) {
  currentServerBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    priorityTotvsStatusBarItem
  );
  currentServerBarItem.command = 'totvs-developer-studio.serverSelection';
  currentServerBarItem.text =
    '$(server-environment-spin)' +
    localize('tds.vscode.initializing', '(initializing)');
  currentServerBarItem.tooltip = currentServerBarItem.text;

  context.subscriptions.push(
    currentServerBarItem,
    serverManager.onDidChange((event: EventData) => {
      if (event.name === 'change' && event.property === 'currentServer') {
        updateStatusBarItem(event.value.new);
      }
    })
  );

  //updateStatusBarItem(undefined);
}

function updateStatusBarItem(selectServer: IServerDebugger | undefined): void {
  currentServerBarItem.text = `$(server-environment) `;

  if (selectServer) {
    currentServerBarItem.text += `${selectServer.name} / ${selectServer.environment}`;
    currentServerBarItem.tooltip = `Address: ${selectServer.address}`;
  } else {
    currentServerBarItem.text += localize(
      'tds.vscode.select_server_environment',
      'Select server/environment'
    );
    currentServerBarItem.tooltip = localize(
      'tds.vscode.select_server_environment.tooltip',
      'Select a server and environment in the server view'
    );
  }

  currentServerBarItem.show();
}

function initPermissionStatusBarItem(context: vscode.ExtensionContext) {
  permissionStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    priorityPermissionStatusBarItem
  );
  permissionStatusBarItem.command = 'totvs-developer-studio.compile.key';
  context.subscriptions.push(
    permissionStatusBarItem,
    serverManager.onDidChange((event: EventData) => {
      if (event.name === 'change' && event.property === 'compileKey') {
        updatePermissionStatusBarItem(event.value);
      }
    })
  );

  //updatePermissionStatusBarItem();
}

function updatePermissionStatusBarItem(infos: ICompileKey): void {
  if (infos && infos.authorizationToken && infos.buildType && infos.expire) {
    const [dd, mm, yyyy] = infos.expire.split('/');
    const expiryDate: Date = new Date(`${yyyy}-${mm}-${dd} 23:59:59`);
    if (expiryDate.getTime() >= new Date().getTime()) {
      const newLine = '\n';
      permissionStatusBarItem.text = 'Permissions: Logged in';
      if (infos.machineId) {
        permissionStatusBarItem.tooltip =
          'Machine ID: ' + infos.machineId + newLine;
      } else if (infos.userId) {
        permissionStatusBarItem.tooltip = 'User ID: ' + infos.userId + newLine;
      }
      permissionStatusBarItem.tooltip +=
        'Expires in ' + expiryDate.toLocaleString() + newLine;

      if (infos.buildType === '0') {
        permissionStatusBarItem.tooltip +=
          'Allow compile functions and overwrite default TOTVS';
      } else if (infos.buildType === '1') {
        permissionStatusBarItem.tooltip += 'Allow only compile users functions';
      } else if (infos.buildType === '2') {
        permissionStatusBarItem.tooltip += 'Allow compile functions';
      }
    } else {
      permissionStatusBarItem.text =
        'Permissions: Expired in ' + expiryDate.toLocaleString();
      permissionStatusBarItem.tooltip = '';
    }
  } else {
    permissionStatusBarItem.text = 'Permissions: NOT logged in';
    permissionStatusBarItem.tooltip = '';
  }
  permissionStatusBarItem.text = `$(key) ${permissionStatusBarItem.text}`;

  permissionStatusBarItem.show();
}

function initRpoTokenStatusBarItem(context: vscode.ExtensionContext) {
  rpoTokenStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    priorityRpoTokenStatusBarItem
  );
  rpoTokenStatusBarItem.command = 'totvs-developer-studio.rpoToken';
  rpoTokenStatusBarItem.text = 'RPO';
  rpoTokenStatusBarItem.tooltip = localize(
    'tds.vscode.rpoToken.initial.tooltip',
    'Select file with RPO token'
  );

  context.subscriptions.push(
    rpoTokenStatusBarItem,
    serverManager.onDidChange((event: EventData) => {
      if (event.name === 'change' && event.property === 'rpoToken') {
        updateRpoTokenStatusBarItem(event.value);
      }
    })
  );

  rpoTokenStatusBarItem.show();
}

function updateRpoTokenStatusBarItem(rpoToken: IRpoToken): void {
  let text: string = 'RPO ';
  let tooltip: string = '';

  if (rpoToken) {
    const error: string = rpoToken.error; // || rpoAux.error;
    const warning: string = rpoToken.warning; // || rpoAux.warning;

    text = buildTextRpoToken(error ? 2 : warning ? 1 : 0, text);
    tooltip = buildTooltipRpoToken(error || warning, tooltip, rpoToken);
  }

  rpoTokenStatusBarItem.text = text;
  rpoTokenStatusBarItem.tooltip = tooltip;
  rpoTokenStatusBarItem.show();
}

function initSettingsBarItem(context: vscode.ExtensionContext): void {
  settingsStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    prioritySettingsStatusBarItem
  );
  context.subscriptions.push(settingsStatusBarItem);
}

function updateSettingsBarItem(): void {
  let behavior: string = TDSConfiguration.autocompleteBehavior() ? 'LS' : '**';

  settingsStatusBarItem.text = `${behavior}`;
  settingsStatusBarItem.tooltip =
    localize('tds.vscode.lssettings.auto.complete', 'Auto complete type') +
    '  ';

  settingsStatusBarItem.show();
}

function buildTextRpoToken(level: number, text: string): string {
  return (
    text + (level == 2 ? '$(error)' : level == 1 ? '$(alert)' : '$(check)')
  );
}

function buildTooltipRpoToken(
  message: string,
  tooltip: string,
  rpoToken: IRpoToken
): string {
  let result: string = tooltip;

  result += message ? `${message}\n` : '';
  if (rpoToken.body) {
    result += `Name: ${rpoToken.body.name}\n`;
    result += `Subject: ${rpoToken.body.sub}\n`;
    result += `Auth: ${rpoToken.body.auth}\n`;
    result += `Validate: ${rpoToken.body.exp.toLocaleDateString()} at ${rpoToken.body.iat.toLocaleDateString()}\n`;
    result += `Emitter: ${rpoToken.body.iss}`;
  }

  return result;
}
