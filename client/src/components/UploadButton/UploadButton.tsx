import { Plus } from 'lucide-react';
import { Button } from '../Button/Button.tsx';
import { useUploads } from '../UploadProvider/UploadProvider.tsx';

/** "Add book": opens the file picker to add books to the shelf. Must sit inside `<UploadProvider>`. */
export function UploadButton() {
  const { pickFiles } = useUploads();

  return (
    <Button variant="primary" icon={<Plus size={18} />} onClick={pickFiles}>
      Add book
    </Button>
  );
}
