package com.metaweb.gridlock.browsing;

import com.metaweb.gridlock.model.Row;

public interface RowVisitor {
	public void visit(Row row);

}