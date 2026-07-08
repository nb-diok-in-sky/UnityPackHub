export interface ICommand {
  execute(): Promise<void>
  undo(): Promise<void>
}
