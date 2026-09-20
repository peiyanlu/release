export type Printer = (message: LoggerMessage) => void

export type Color = (text: string) => string

export interface LoggerOptions {
  silent?: boolean
  dryRun?: boolean
  verbose?: boolean
  printer?: Printer
  colors?: Color[]
}

export interface LoggerMessage {
  dryRun?: boolean
  stage: string
  message: unknown
  color: Color
}


const defaultPrinter = ({ dryRun, stage, message }: LoggerMessage) => {
  console.log(`${ dryRun ? `[dry-run]` : '' }[${ stage }]:`, message)
}

/** 一个子消息记录器，绑定到特定阶段 */
export class ChildLogger {
  /**
   * 创建子日志记录器。
   * @param parent - 要继承其选项的父日志记录器。
   * @param stage - 此日志记录器所属的处理阶段。
   */
  constructor(
    public parent: Logger,
    public stage: string,
  ) {}
  
  /**
   * 记录一条普通信息。
   * @param message - 要记录的信息。
   */
  info(message: unknown): void {
    this.parent.info(this.stage, message)
  }
  
  /**
   * 记录一条详细信息。
   * @param message - 要记录的信息。
   */
  verbose(message: unknown): void {
    this.parent.verbose(this.stage, message)
  }
}

/** 消息记录器 */
export class Logger {
  public readonly printer: Printer
  private readonly colors: Color[]
  private readonly colorMap = new Map<string, Color>()
  
  constructor(public options: LoggerOptions = {}) {
    const { colors = [], printer = defaultPrinter } = options
    
    this.colors = colors
    this.printer = printer
  }
  
  info(stage: string, message: unknown): void {
    const { silent, dryRun } = this.options
    
    if (!silent) {
      const color = this.getColor(stage)
      this.printer({ dryRun, stage, message, color })
    }
  }
  
  verbose(stage: string, message: unknown): void {
    const { silent, verbose, dryRun } = this.options
    
    if (!silent && (verbose || dryRun)) {
      const color = this.getColor(stage)
      this.printer({ dryRun, stage, message, color })
    }
  }
  
  createChild(stage: string): ChildLogger {
    return new ChildLogger(this, stage)
  }
  
  private getColor(stage: string): Color {
    const cached = this.colorMap.get(stage)
    if (cached) return cached
    
    const index = this.colorMap.size % this.colors.length
    const color = this.colors[index] ?? ((text: string) => text)
    
    this.colorMap.set(stage, color)
    
    return color
  }
}
