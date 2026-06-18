import { AlertCircle, CheckCircle2, TriangleAlert, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { H4 } from '@/components/ui/h';

export default function AlertStyleGuide() {
  return (
    <div className="py-12">
      <H4 className="mb-3">Alerts</H4>
      <p>
        Alerts are used to display important information to the user. The <code>role</code> attribute must be considered
        for each use case.
      </p>

      <div className="grid gap-4 mt-2">
        <Alert>
          <AlertTitle>Default</AlertTitle>
          <AlertDescription>
            <p>This is a default alert.</p>
            <p>Icons are optional.</p>
          </AlertDescription>
        </Alert>

        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Your changes were saved successfully.</AlertDescription>
        </Alert>

        <Alert variant="information">
          <AlertCircle />
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>Some additional information for the user.</AlertDescription>
        </Alert>

        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>Please double-check the entered data.</AlertDescription>
        </Alert>

        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Destructive</AlertTitle>
          <AlertDescription>Something went wrong. Please try again.</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
