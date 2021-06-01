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

import { IGetPatchDirResult } from '../../protocolMessages';
import { InspectorObject } from '../patchGenerate';

export const GENERATE_PATCH_ERROR_CODE = {
  OK: 0,
};

export enum PatchProcess {
  fromRpo,
  byDiff,
}

export declare interface IServerFS {
  id: string;
  name: string;
  children: IServerFS[];
  directory: boolean;
  path: string;
  parentId: string;
}

export interface IGeneratePatchData {
  process: PatchProcess;
  ignoreTres: boolean;
  resources: InspectorObject[];
  selectedResources: InspectorObject[];
  targetFolder: string;
  targetFile: string;
  rpoMaster: string;
  rootFolder: IServerFS;
  loading: boolean;
  serverName: string;
  generate: boolean;
}
