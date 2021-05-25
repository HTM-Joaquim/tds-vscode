import * as vscode from 'vscode';
import { languageClient } from '../extension';
import { IServerDebugger, serverManager } from '../serverManager';
import { TDSConfiguration } from '../configurations';

export function toggleAutocompleteBehavior() {
  let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    'totvsLanguageServer'
  );
  let behavior = config.get('editor.toggle.autocomplete');

  if (behavior === 'Basic') {
    behavior = 'LS';
  } else {
    behavior = 'Basic';
  }
  config.update('editor.toggle.autocomplete', behavior);
}

export function syncSettings() {
  //@acandido
  let includesList: string[] = serverManager.getIncludes('', true);
  let includes: string = includesList.join(';');

  changeSettings({
    changeSettingInfo: { scope: 'advpls', key: 'includes', value: includes },
  });

  changeSettings({
    changeSettingInfo: {
      scope: 'advpls',
      key: 'autocomplete',
      value: TDSConfiguration.autocompleteBehavior(),
    },
  });

  changeSettings({
    changeSettingInfo: {
      scope: 'advpls',
      key: 'notificationlevel',
      value: TDSConfiguration.notificationLevel(),
    },
  });
}

function changeSettings(jsonData: any) {
  //@acandido
  languageClient.sendRequest('$totvsserver/changeSetting', jsonData).then(
    (value: any) => {
      vscode.window.showInformationMessage(value);
    },
    (error: any) => {
      vscode.window.showErrorMessage(error);
    }
  );
}
