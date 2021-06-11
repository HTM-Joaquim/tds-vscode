import * as vscode from 'vscode';
import { TotvsConfigurationProvider } from './TotvsConfigurationProvider';
import { TotvsConfigurationWebProvider } from './TotvsConfigurationWebProvider';
import { TotvsDebugAdapterDescriptorFactory } from './TotvsDebugAdapterDescriptorFactory';
import { TotvsConfigurationTdsReplayProvider } from './TotvsConfigurationTdsReplayProvider';
import {
  processDebugCustomEvent,
  procesStartDebugSessionEvent,
} from './debugEvents';

export let _debugEvent = undefined;

export const registerDebug = (context: vscode.ExtensionContext): vscode.Disposable => {
  const factory = new TotvsDebugAdapterDescriptorFactory(context);

  /****** Configurações de execução do debugger regular **/

  const debugProvider = new TotvsConfigurationProvider();
  registerDebugAdapter(
    context,
    TotvsConfigurationProvider.type,
    debugProvider,
    factory
  );

  /**** Configurações de execução do debug com TDS Replay *******/

  const tdsReplayProvider = new TotvsConfigurationTdsReplayProvider();
  registerDebugAdapter(
    context,
    TotvsConfigurationTdsReplayProvider.type,
    tdsReplayProvider,
    factory
  );

  /***** Configuração de debug web *****/
  const webProvider = new TotvsConfigurationWebProvider();
  registerDebugAdapter(
    context,
    TotvsConfigurationWebProvider.type,
    webProvider,
    factory
  );

  /** Configurações gerais de debug  */

  const onDidStartDebugSession = vscode.debug.onDidStartDebugSession(
    (event: any) => {
      procesStartDebugSessionEvent(event);
    }
  );

  const onDidReceiveDebugSessionCustomEvent =
    vscode.debug.onDidReceiveDebugSessionCustomEvent(
      (debugEvent: vscode.DebugSessionCustomEvent) => {
        _debugEvent = debugEvent;
        processDebugCustomEvent(debugEvent);
      }
    );

  const onDidTerminateDebugSession = vscode.debug.onDidTerminateDebugSession(
    () => {
      _debugEvent = undefined;
    }
  );

  return vscode.Disposable.from(
    debugProvider,
    tdsReplayProvider,
    webProvider,
    onDidStartDebugSession,
    onDidReceiveDebugSessionCustomEvent,
    onDidTerminateDebugSession
  );
};

function registerDebugAdapter(
  context: vscode.ExtensionContext,
  type: string,
  provider: vscode.DebugConfigurationProvider,
  factory: vscode.DebugAdapterDescriptorFactory
) {
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(type, provider)
  );

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(type, factory)
  );
}
