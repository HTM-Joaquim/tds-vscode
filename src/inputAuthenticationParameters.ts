import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { MultiStepInput } from './multiStepInput';
import { IServerDebugger, serverManager } from './serverManager';
import { LS_SERVER_ENCODING } from '@totvs/tds-languageclient';

/**
 * Coleta os dados necessarios para logar a um servidor advpl/4gl.
 *
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 *
 *
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 */
const localize = nls.loadMessageBundle();

export async function inputAuthenticationParameters(
  serverItem: IServerDebugger,
  environment: string
) {
  //const VALIDADE_TIME_OUT = 1000;
  const title = localize('AUTHENTICATION', 'Authentication');

  let AUTH_TOTAL_STEPS = 2;
  let AUTH_USERNAME_STEP = 1;
  let AUTH_PASSWORD_STEP = 2;

  //@acandido
  const serversConfig = serverManager.getConfigurations(serverManager.userFile)
    .servers;

  interface State {
    title: string;
    step: number;
    totalSteps: number;
    username: string;
    password: string;
  }

  async function collectAuthenticationInputs() {
    const state = {} as Partial<State>;

    if (serverItem) {
      state.username = serverItem.username;
    }

    await MultiStepInput.run((input) =>
      inputUsername(input, state, serversConfig)
    );

    return state as State;
  }

  async function inputUsername(
    input: MultiStepInput,
    state: Partial<State>,
    serversConfig: any
  ) {
    state.username = await input.showInputBox({
      title: title,
      step: AUTH_USERNAME_STEP,
      totalSteps: AUTH_TOTAL_STEPS,
      value: state.username || '',
      prompt: localize('USER_IDENTIFICATION', 'User identification'),
      validate: validateRequiredValue,
      shouldResume: shouldResume,
      password: false,
    });

    return (input: MultiStepInput) =>
      inputPassword(input, state, serversConfig);
  }

  async function inputPassword(
    input: MultiStepInput,
    state: Partial<State>,
    serversConfig: any
  ) {
    state.password = await input.showInputBox({
      title: title,
      step: AUTH_PASSWORD_STEP,
      totalSteps: AUTH_TOTAL_STEPS,
      value: state.password || '',
      prompt: localize('ACCESS PASSWORD', 'Access password'),
      validate: allTrueValue,
      shouldResume: shouldResume,
      password: true,
    });
  }

  function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => {
      return false;
    });
  }

  async function allTrueValue(value: string) {
    // ...validate...
    //await new Promise(resolve => setTimeout(resolve, VALIDADE_TIME_OUT));

    return undefined;
  }

  async function validateRequiredValue(value: string) {
    // ...validate...
    //Nao esta claro o motivo desse timeout, pois o resolve nunca é passado e sempre é esperado o total do timeout antes de continuar
    //await new Promise(resolve => setTimeout(resolve, VALIDADE_TIME_OUT));
    return value === ''
      ? localize('REQUIRED_INFORMATION', 'Required information')
      : undefined;
  }

  async function main() {
    const authState = await collectAuthenticationInputs();
    authenticate(
      serverItem,
      environment,
      authState.username,
      authState.password
    );
  }

  main();
}

export function authenticate(
  serverItem: IServerDebugger,
  environment: string,
  username: string,
  password: string
) {
  const enconding: LS_SERVER_ENCODING =
    vscode.env.language === 'ru'
      ? LS_SERVER_ENCODING.CP1251
      : LS_SERVER_ENCODING.CP1252;

  vscode.window.setStatusBarMessage(
    `Autenticando usuário [${username}] no servidor [${serverItem.name}]`,
    serverItem.authenticate(environment, username, password, enconding).then(
      (result: boolean) => {
        if (result) {
          serverManager.currentServer = serverItem;
        } else {
          vscode.window.showErrorMessage(serverItem.lastError.message);
        }
        return serverItem.token;
      },
      (error: any) => {
        vscode.window.showErrorMessage(error);
        return false;
      }
    )
  );
}
