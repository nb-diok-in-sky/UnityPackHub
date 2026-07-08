import mitt from 'mitt'
import type { AppEvents } from '../types/events'

export const eventBus = mitt<AppEvents>()
