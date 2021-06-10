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
import path = require('path');
import { EventData, EventName, EventProperty, IEventManager } from './eventInterface';

class EventManager implements IEventManager {
  private _onDidChange: vscode.EventEmitter<EventData> =
    new vscode.EventEmitter<EventData>();
  private _enableEvents: boolean = true;

  public get enableEvents(): boolean {
    return this._enableEvents;
  }

  public get onDidChangeEmiter(): vscode.EventEmitter<EventData> {
    return this._onDidChange;
  }

  public readonly onDidChange: vscode.Event<EventData> = this._onDidChange.event;

  public set enableEvents(value: boolean) {
    this._enableEvents = value;

    if (value) {
      this.fireEvent(this, 'change', 'enableEvents', value);
    }
  }

  fireEvent(sender: Object, name: EventName | string, property: EventProperty | string, value: any) {
    if (this._enableEvents) {
      this._onDidChange.fire({
        sender: sender,
        name: name as EventName,
        property: property as EventProperty,
        value: value,
      });
    }
  }
}

export const eventManager: IEventManager = new EventManager();
