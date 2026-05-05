'use client';

import { TriangleAlert } from 'lucide-react';

/**
 * Banner displayed when the CMSComponentDefinitionService is not registered in the DI container.
 * Guides the developer to implement the required service interface.
 */
export default function CMSSetupMissingDialog() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#ffffff]">
      <div className="mx-4 max-w-2xl rounded-lg border bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">CMS Extension — Setup Incomplete</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              The{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900">
                EmporixCMSComponentService
              </code>{' '}
              is not registered in the DI container. Please follow the extension&apos;s installation instructions.
            </p>
            <div className="rounded-md bg-amber-100 p-4 dark:bg-amber-900/50">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Quick Fix
              </p>
              <ol className="list-inside list-decimal space-y-1.5 text-sm text-amber-700 dark:text-amber-300">
                <li>
                  Create a class that implements{' '}
                  <code className="rounded bg-amber-200 px-1 py-0.5 font-mono text-xs dark:bg-amber-800">
                    CMSComponentService
                  </code>
                </li>
                <li>
                  Decorate it with{' '}
                  <code className="rounded bg-amber-200 px-1 py-0.5 font-mono text-xs dark:bg-amber-800">
                    @injectable(&apos;EmporixCMSComponentService&apos;, &apos;Singleton&apos;)
                  </code>
                </li>
                <li>
                  Implement{' '}
                  <code className="rounded bg-amber-200 px-1 py-0.5 font-mono text-xs dark:bg-amber-800">
                    getDefinitions()
                  </code>
                  ,{' '}
                  <code className="rounded bg-amber-200 px-1 py-0.5 font-mono text-xs dark:bg-amber-800">
                    getDefinition(type)
                  </code>
                  , and{' '}
                  <code className="rounded bg-amber-200 px-1 py-0.5 font-mono text-xs dark:bg-amber-800">
                    getComponentTypes()
                  </code>
                </li>
              </ol>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              See the provided <strong>INSTALLATION.md</strong> §&nbsp;Service Interface Implementation for full
              details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
