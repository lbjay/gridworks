package com.metaweb.gridlock.browsing.facets;

import java.util.Properties;

import org.json.JSONException;
import org.json.JSONObject;

import com.metaweb.gridlock.browsing.FilteredRows;
import com.metaweb.gridlock.browsing.filters.RowFilter;

public interface Facet {
	public RowFilter getRowFilter();
	
	public void computeChoices(FilteredRows filteredRows);
	
	public JSONObject getJSON(Properties options) throws JSONException;

	public void initializeFromJSON(JSONObject o) throws JSONException;
}