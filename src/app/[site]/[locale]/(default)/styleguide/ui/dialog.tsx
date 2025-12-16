import { User } from 'lucide-react';
import LoginDialog from '@/components/login/login-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { H4, H5 } from '@/components/ui/h';

export default function DialogStyleguide() {
  return (
    <div className="py-12 space-y-12">
      <div>
        <H4 className="mb-6">Dialog</H4>
        <p className="text-lg mb-8">Examples of different ways to open and control dialogs.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <Card className="p-6">
          <H5 className="mb-4">Dialog with Button Trigger</H5>
          <p className="mb-6">Dialog with a button as trigger</p>
          <LoginDialog trigger={<Button variant="primary">Open Login</Button>} />
        </Card>

        <Card className="p-6">
          <H5 className="mb-4">Dialog with Text Trigger</H5>
          <p className="mb-6">Dialog with text as trigger</p>
          <LoginDialog
            trigger={<span className="text-text-action underline cursor-pointer">Click here to login</span>}
          />
        </Card>

        <Card className="p-6">
          <H5 className="mb-4">Dialog with Icon Trigger</H5>
          <p className="mb-6">Dialog with icon as trigger</p>
          <LoginDialog
            trigger={
              <div className="flex items-center gap-2 cursor-pointer text-text-action">
                <User />
                <span>Login</span>
              </div>
            }
          />
        </Card>
      </div>
    </div>
  );
}
