'use client';

import { Avatar } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ApprovalUser } from '@/platform/services/model/approval';

export type ApproverSelectListProps = {
  approvers: ApprovalUser[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  testIdPrefix: string;
};

function getApproverDisplayName(approver: ApprovalUser): string {
  const name = `${approver.firstName ?? ''} ${approver.lastName ?? ''}`.trim();
  if (name) {
    return name;
  }
  return approver.fullName?.trim() ?? '';
}

function getApproverInitial(approver: ApprovalUser): string {
  return approver.firstName?.charAt(0) || approver.lastName?.charAt(0) || 'U';
}

export function ApproverSelectList({ approvers, selectedUserId, onSelect, testIdPrefix }: ApproverSelectListProps) {
  return (
    <ScrollArea
      type="auto"
      className="max-h-[200px] rounded-md border [&>[data-slot=scroll-area-viewport]]:max-h-[200px]"
    >
      <RadioGroup value={selectedUserId ?? undefined} onValueChange={onSelect} className="gap-2 p-2">
        {approvers.map((approver) => {
          const isSelected = selectedUserId === approver.userId;
          const radioId = `${testIdPrefix}-radio-${approver.userId}`;

          return (
            <Label
              key={approver.userId}
              htmlFor={radioId}
              data-testid={`${testIdPrefix}-${approver.userId}`}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-md border p-4 font-normal',
                isSelected
                  ? 'border-border-secondary bg-surface-action-hover-2'
                  : 'border-transparent hover:bg-surface-action-hover-2',
              )}
            >
              <Avatar className="size-8 shrink-0">
                <div className="bg-surface-action text-text-on-action flex h-full w-full items-center justify-center rounded-full">
                  {getApproverInitial(approver)}
                </div>
              </Avatar>
              <span className="text-text-body flex-1 font-bold">{getApproverDisplayName(approver)}</span>
              <RadioGroupItem id={radioId} value={approver.userId} />
            </Label>
          );
        })}
      </RadioGroup>
    </ScrollArea>
  );
}
