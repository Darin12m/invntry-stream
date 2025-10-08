import React, { useState, useEffect, useDeferredValue } from 'react';
import { Search } from 'lucide-react';
import { Input } from "@/components/ui/input";

interface ProductSearchInputProps {
  onSearchTermChange: (term: string) => void;
  initialSearchTerm?: string;
}

const ProductSearchInput: React.FC<ProductSearchInputProps> = ({ onSearchTermChange, initialSearchTerm = '' }) => {
  const [searchInput, setSearchInput] = useState(initialSearchTerm);
  const deferredSearch = useDeferredValue(searchInput);

  // Update internal searchInput if initialSearchTerm changes from parent (e.g., clear filters)
  useEffect(() => {
    if (initialSearchTerm !== searchInput && deferredSearch === initialSearchTerm) {
      setSearchInput(initialSearchTerm);
    }
  }, [initialSearchTerm, searchInput, deferredSearch]);

  // Notify parent only when the deferred search term changes
  useEffect(() => {
    onSearchTermChange(deferredSearch);
  }, [deferredSearch, onSearchTermChange]);

  return (
    <div className="relative flex-1 w-full">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search products by name, SKU, or category..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary"
      />
    </div>
  );
};

export default ProductSearchInput;