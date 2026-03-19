import { Return } from '@/platform/services/model/return';
import { Mapper } from '../Mapper';

/**
 * Specialized mapper interface for transforming between external return data sources
 * and the internal Return domain model.
 *
 * @template SOURCE_TYPE - The external return data format (typically from an API or data source)
 * @extends {Mapper<SOURCE_TYPE, Return>} - Extends the generic Mapper interface with Return as the service type
 */
export interface ReturnMapper<SOURCE_TYPE> extends Mapper<SOURCE_TYPE, Return> {}
