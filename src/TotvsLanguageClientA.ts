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
import {
  LanguageClient,
  ServerOptions,
  LanguageClientOptions,
} from 'vscode-languageclient/node';

export class TotvsLanguageClientA extends LanguageClient {
  freshenIndex() {
    throw new Error('Method not implemented.');
  }
  constructor(
    serverOptions: ServerOptions,
    clientOptions: LanguageClientOptions
  ) {
    super(
      'totvsLanguageServer',
      'TOTVS Language Server',
      serverOptions,
      clientOptions
    );
  }
  registerBuiltinFeatures() {
    super.registerBuiltinFeatures();
  }
}
