import type { ICommand } from '../types/commands'

export class CommandManager {
  private undoStack: ICommand[] = []
  private redoStack: ICommand[] = []
  private readonly maxHistory = 50

  async execute(command: ICommand): Promise<void> {
    await command.execute()
    this.undoStack.push(command)
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }
    this.redoStack.length = 0
  }

  async undo(): Promise<boolean> {
    const command = this.undoStack.pop()
    if (!command) return false
    await command.undo()
    this.redoStack.push(command)
    return true
  }

  async redo(): Promise<boolean> {
    const command = this.redoStack.pop()
    if (!command) return false
    await command.execute()
    this.undoStack.push(command)
    return true
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get historySize(): number {
    return this.undoStack.length
  }

  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }
}

export const commandManager = new CommandManager()
