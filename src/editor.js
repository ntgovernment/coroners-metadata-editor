(function ($) {
  // Capture jQuery at script-evaluation time before any later script overwrites $.
  var apiOptions = new Array();
  apiOptions["key"] = "5070102576";
  var js_api = new Squiz_Matrix_API(apiOptions);

  $(document).ready(function () {
    var dtTable;

    // ===== Default selections for <select> elements =====
    $(".metadata_options").each(function () {
      var presetValue = $(this).attr("data-current");
      if ($(this).prop("multiple")) {
        try {
          $(this).val(JSON.parse(presetValue));
        } catch (e) {
          $(this).val(presetValue);
        }
      } else {
        $(this).val(presetValue);
      }
    });

    // ===== Helpers =====

    function getOptionDisplayText($select) {
      var labels = $select
        .find("option:selected")
        .map(function () {
          return $(this).text();
        })
        .get()
        .join("\n");
      return labels || "\u00a0";
    }

    function isoToAustralian(isoDate) {
      if (!isoDate || isoDate === "") return "";
      var datePart = isoDate.split(" ")[0];
      var parts = datePart.split("-");
      if (parts.length === 3) {
        return parts[2] + "/" + parts[1] + "/" + parts[0];
      }
      return isoDate;
    }

    function australianToIso(ausDate) {
      if (!ausDate || ausDate === "") return "";
      var parts = ausDate.split("/");
      if (parts.length === 3) {
        return parts[2] + "-" + parts[1] + "-" + parts[0];
      }
      return ausDate;
    }

    // ===== Metadata select display divs =====
    // Show a clickable display div at rest; reveal <select> on click.
    $("select.metadata_options").each(function () {
      var $select = $(this);
      var $existing = $select.prev(".metadata_option_display");
      if ($existing.length) {
        var newText = getOptionDisplayText($select);
        var fallback = $existing.text().trim();
        $existing
          .attr("data-label", $select.attr("data-label") || "")
          .css({ minHeight: "1em" })
          .text(newText === "\u00a0" && fallback ? fallback : newText);
      } else {
        var $display = $('<div class="metadata_option_display"></div>')
          .attr("data-label", $select.attr("data-label") || "")
          .css({ minHeight: "1em" })
          .text(getOptionDisplayText($select));
        $select.before($display);
      }
      $select.hide();
    });

    // ===== ACCESSIBILITY: Initialize focusable cells =====
    var initEditableCells = function () {
      $(".edit_area").each(function () {
        var $el = $(this);
        if (!$el.attr("tabindex")) {
          $el.attr({
            tabindex: "0",
            role: "button",
            "aria-label": $el.attr("data-label") || "editable field",
          });
        }
      });
      $(".metadata_option_display").each(function () {
        var $el = $(this);
        if (!$el.attr("tabindex")) {
          $el.attr({
            tabindex: "0",
            role: "button",
            "aria-label": $el.attr("data-label") || "select field",
          });
        }
      });
    };
    initEditableCells();

    // Make the save-result toast accessible to screen readers
    $(".results").attr({
      role: "alert",
      "aria-live": "assertive",
      "aria-atomic": "true",
    });

    // ===== Focus trap helpers =====
    var attachFocusTrap = function (
      $editContainer,
      $originalCell,
      closeEditFn,
    ) {
      var focusableSelectors =
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
      var $focusables = $editContainer
        .find(focusableSelectors)
        .filter(":visible");
      if ($focusables.length === 0) return;

      var firstFocusable = $focusables.first();
      var lastFocusable = $focusables.last();

      $editContainer.on("keydown.focusTrap", function (e) {
        if (e.keyCode === 9) {
          var isShiftTab = e.shiftKey;
          var activeEl = document.activeElement;
          if (isShiftTab && activeEl === firstFocusable[0]) {
            e.preventDefault();
            closeEditFn();
            $originalCell.focus();
          } else if (!isShiftTab && activeEl === lastFocusable[0]) {
            e.preventDefault();
            closeEditFn();
            $originalCell.focus();
          }
        }
      });
    };

    var detachFocusTrap = function ($editContainer) {
      $editContainer.off("keydown.focusTrap");
    };

    // ===== Dropdown click handler (single + multi-select) =====
    $(document).on("click", ".metadata_option_display", function () {
      var $display = $(this);
      var $select = $display.nextAll("select.metadata_options").first();
      var isMultiple = $select.prop("multiple");
      var label = $select.attr("data-label");
      var currentVal = $select.val();
      $select.data(
        "original-val",
        Array.isArray(currentVal) ? currentVal.slice() : currentVal,
      );
      if (!$display.attr("data-label") && label) {
        $display.attr("data-label", label);
      }
      $display.hide();

      if (!isMultiple) {
        // Single-select: native <select> dropdown popup
        var $ddSelect = $(
          '<select class="form-control single-dropdown-select"></select>',
        );
        $select.find("option").each(function () {
          var $opt = $("<option></option>")
            .val($(this).val())
            .text($(this).text());
          if ($(this).is(":selected")) $opt.prop("selected", true);
          $ddSelect.append($opt);
        });
        var $saveBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
        );
        var $cancelBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
        );
        var $actions = $('<div class="single-dropdown-actions"></div>').append(
          $saveBtn,
          $cancelBtn,
        );
        var $dropdown = $('<div class="single-dropdown"></div>').append(
          $ddSelect,
          $actions,
        );
        $display.after($dropdown);

        attachFocusTrap($dropdown, $display, function () {
          var originalVal = $select.data("original-val");
          if (originalVal !== undefined) $select.val(originalVal);
          detachFocusTrap($dropdown);
          $dropdown.remove();
          $display.text(getOptionDisplayText($select)).show();
        });
        $ddSelect.focus();
        return;
      }

      // Multi-select: build checkbox list
      var $list = $('<div class="multiselect-list"></div>');
      $select.find("option").each(function () {
        var $cb = $("<input type='checkbox'/>")
          .val($(this).val())
          .prop("checked", $(this).is(":selected"));
        var $label = $("<label></label>").append(
          $cb,
          document.createTextNode("\u00a0" + $(this).text()),
        );
        $list.append($label);
      });
      var $saveBtn = $(
        '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
      );
      var $cancelBtn = $(
        '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
      );
      var $actions = $('<div class="metadata_option_actions"></div>').append(
        $saveBtn,
        $cancelBtn,
      );
      var $dropdown = $('<div class="multiselect-dropdown"></div>').append(
        $list,
        $actions,
      );
      $display.after($dropdown);

      attachFocusTrap($dropdown, $display, function () {
        var originalVal = $select.data("original-val");
        if (originalVal !== undefined) $select.val(originalVal);
        detachFocusTrap($dropdown);
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
      });

      var $firstCb = $dropdown.find("input[type=checkbox]").first();
      if ($firstCb.length) $firstCb.focus();
    });

    // Multi-select Save
    $(document).on(
      "click",
      ".metadata_option_actions [data-action='save']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".multiselect-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var checkedVals = $dropdown
          .find("input[type=checkbox]:checked")
          .map(function () {
            return $(this).val();
          })
          .get();
        $select.val(checkedVals);
        var value = $select.val() ? $select.val().join("; ") : "";
        var assetid = $select.closest("tr").attr("id");
        var fieldid = $select.attr("data-metadatafieldid");
        detachFocusTrap($dropdown);
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
        $display.focus();
        submit(value, assetid, fieldid);
      },
    );

    // Multi-select Cancel
    $(document).on(
      "click",
      ".metadata_option_actions [data-action='cancel']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".multiselect-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var originalVal = $select.data("original-val");
        if (originalVal !== undefined) $select.val(originalVal);
        detachFocusTrap($dropdown);
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
        $display.focus();
      },
    );

    // Single-select Save
    $(document).on(
      "click",
      ".single-dropdown-actions [data-action='save']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".single-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var newVal = $dropdown.find(".single-dropdown-select").val();
        var assetid = $select.closest("tr").attr("id");
        var fieldid = $select.attr("data-metadatafieldid");
        $select.val(newVal);
        detachFocusTrap($dropdown);
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
        $display.focus();
        submit(newVal, assetid, fieldid);
      },
    );

    // Single-select Cancel
    $(document).on(
      "click",
      ".single-dropdown-actions [data-action='cancel']",
      function (e) {
        e.stopPropagation();
        var $dropdown = $(this).closest(".single-dropdown");
        if (!$dropdown.length) return;
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var originalVal = $select.data("original-val");
        if (originalVal !== undefined) $select.val(originalVal);
        detachFocusTrap($dropdown);
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
        $display.focus();
      },
    );

    // Click outside dropdowns: treat as Cancel
    $(document).on("click", function (e) {
      if (
        $(e.target).closest(
          ".metadata_option_display, .multiselect-dropdown, .single-dropdown",
        ).length
      )
        return;
      $(".multiselect-dropdown, .single-dropdown").each(function () {
        var $dropdown = $(this);
        var $display = $dropdown.prev(".metadata_option_display");
        var $select = $dropdown.next("select.metadata_options");
        var originalVal = $select.data("original-val");
        if (originalVal !== undefined) $select.val(originalVal);
        detachFocusTrap($dropdown);
        $dropdown.remove();
        $display.text(getOptionDisplayText($select)).show();
      });
    });

    // Enter key opens dropdown
    $(document).on("keydown", ".metadata_option_display", function (e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        $(this).click();
      }
    });

    // ===== Inline click-to-edit (replaces jquery.editable) =====
    function makeEditable(selector, onSave) {
      $(selector).css({ cursor: "pointer", minHeight: "1em" });

      var activateEdit = function ($el) {
        if ($el.find("textarea").length) return;
        var savedText = $el.text().trim();

        var $textarea = $('<textarea class="form-control" rows="2">').val(
          savedText,
        );
        var $saveBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
        );
        var $cancelBtn = $(
          '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
        );
        var $actions = $(
          '<div style="margin-top:4px;display:flex;gap:4px;">',
        ).append($saveBtn, $cancelBtn);

        $el.empty().append($textarea, $actions);
        $textarea.focus();

        var closeEdit = function () {
          $el.empty().text(savedText);
          detachFocusTrap($el);
          $el.focus();
        };

        $cancelBtn.on("click", function (e) {
          e.stopPropagation();
          closeEdit();
        });

        $saveBtn.on("click", function (e) {
          e.stopPropagation();
          detachFocusTrap($el);
          onSave($textarea.val(), $el);
        });

        $textarea.on("keydown.inlineEdit", function (e) {
          if (e.keyCode === 27) {
            e.preventDefault();
            closeEdit();
          }
        });

        attachFocusTrap($el, $el, closeEdit);
      };

      $(document).on("click.inlineEdit", selector, function () {
        activateEdit($(this));
      });

      $(document).on("keydown.inlineEdit", selector, function (e) {
        if (e.keyCode === 13) {
          e.preventDefault();
          activateEdit($(this));
        }
      });
    }

    makeEditable(
      ".metadata-editor .edit_area:not([data-datepicker='true'])",
      function (value, $el) {
        var assetid = $el.closest("tr").attr("id");
        var fieldid = $el.attr("data-metadatafieldid");
        submit(value, assetid, fieldid);
      },
    );

    // ===== Bootstrap Datepicker for date fields =====
    var activateDatepicker = function ($field) {
      if ($field.find("input").length > 0) return;

      var currentText = $field.text().trim();
      var $input = $('<input type="text" class="form-control">');
      $input.val(currentText);

      var $saveBtn = $(
        '<button type="button" class="ntgc-btn btn-sm ntgc-btn--secondary" data-action="save"><span class="fal fa-save"></span> Save</button>',
      );
      var $cancelBtn = $(
        '<button type="button" class="ntgc-btn btn-sm ntgc-btn--tertiary" data-action="cancel">Cancel</button>',
      );
      var $actions = $(
        '<div style="margin-top:4px;display:flex;gap:4px;">',
      ).append($saveBtn, $cancelBtn);

      $field.empty().append($input, $actions);

      var selectedIsoDate = null;
      var selectedDisplayDate = null;

      $input.datepicker({
        format: "dd/mm/yyyy",
        autoclose: true,
        todayBtn: "linked",
        todayHighlight: true,
        orientation: "bottom auto",
        container: "body",
      });

      $input.datepicker("show");
      setTimeout(function () {
        $input.focus();
      }, 50);

      $input.on("changeDate", function (e) {
        if (e.date) {
          selectedDisplayDate = $input.datepicker("getFormattedDate");
          selectedIsoDate = australianToIso(selectedDisplayDate);
        }
      });

      var closeDate = function () {
        $input.datepicker("destroy");
        $field.empty().text(currentText);
        detachFocusTrap($field);
        $field.focus();
      };

      $cancelBtn.on("click", function (e) {
        e.stopPropagation();
        closeDate();
      });

      $saveBtn.on("click", function (e) {
        e.stopPropagation();
        var displayDate = selectedDisplayDate || $input.val().trim();
        var isoDate = selectedIsoDate || australianToIso(displayDate);
        var assetid = $field.closest("tr").attr("id");
        var fieldid = $field.attr("data-metadatafieldid");
        $input.datepicker("destroy");
        $field.empty().text(displayDate);
        detachFocusTrap($field);
        $field.focus();
        submit(isoDate, assetid, fieldid);
      });

      $input.on("keydown.datepickerEsc", function (e) {
        if (e.keyCode === 27) {
          e.preventDefault();
          closeDate();
        }
      });

      attachFocusTrap($field, $field, closeDate);
    };

    // Convert ISO dates to DD/MM/YYYY for display
    $(".edit_area[data-datepicker='true']").each(function () {
      var $field = $(this);
      $field.text(isoToAustralian($field.text().trim()));
      $field.css({ cursor: "pointer", minHeight: "1em" });
    });

    $(document).on(
      "click.datepicker",
      ".edit_area[data-datepicker='true']",
      function () {
        activateDatepicker($(this));
      },
    );
    $(document).on(
      "keydown.datepicker",
      ".edit_area[data-datepicker='true']",
      function (e) {
        if (e.keyCode === 13) {
          e.preventDefault();
          activateDatepicker($(this));
        }
      },
    );

    // ===== API submission =====
    function submit(content, assetID, fieldid) {
      js_api.setMetadata({
        asset_id: assetID,
        field_id: fieldid,
        field_val: content,
        dataCallback: result,
        errorCallback: function () {
          displayResult("Save failed \u2014 please try again.", "error");
        },
      });
    }

    function result(data) {
      if ("success" in data) {
        displayResult(data.success[0], "success");
        refreshTableCell(data);
      } else if ("error" in data) {
        displayResult(data.error, "error");
      }
    }

    function refreshTableCell(data) {
      if (!data.changes || !data.changes[0]) return;
      var updatedData = data.changes[0];

      var $row = $('tr[id="' + updatedData.assetid + '"]');
      if (!$row.length) return;

      var $cell = $row.find(
        '.edit_area[data-metadatafieldid="' + updatedData.fieldid + '"]',
      );
      if ($cell.length) {
        if ($cell.attr("data-datepicker") === "true") {
          $cell.text(isoToAustralian(updatedData.value));
        } else {
          $cell.text(updatedData.value);
        }
      }

      if (dtTable) {
        dtTable.row($row[0]).invalidate("dom").draw(false);
      }
    }

    function displayResult(msg, status) {
      $(".results")
        .removeClass("alert-success alert-error")
        .addClass("alert-" + status);
      $(".results").text(msg).show();
      setTimeout(function () {
        $(".results").fadeOut();
      }, 3000);
    }

    // ===== DataTables initialization =====
    // Column indices:
    //  0: ID, 1: Asset name, 2: Death of, 3: Link Text, 4: Override,
    //  5: Inquest date, 6: Issue date, 7: Date text, 8: Location,
    //  9: Category, 10: Year (hidden), 11: Tags
    dtTable = $("#myTable").DataTable({
      paging: true,
      pageLength: 10,
      pagingType: "simple_numbers",
      ordering: true,
      order: [[6, "desc"]],
      searching: true,
      info: true,
      dom: '<"dt-top-ctrl"lf><t><"dt-bottom-row"ip>',
      columnDefs: [
        {
          targets: "_all",
          render: function (data, type) {
            if (type === "display") return data;
            var tmp = document.createElement("div");
            tmp.innerHTML = data;
            var el =
              tmp.querySelector(".metadata_option_display") ||
              tmp.querySelector(".edit_area");
            return el ? el.textContent.trim() : tmp.textContent.trim();
          },
        },
        {
          // Inquest date (col 5): DD/MM/YYYY → YYYYMMDD for chronological sort
          targets: 5,
          render: function (data, type) {
            if (type === "display") return data;
            var tmp = document.createElement("div");
            tmp.innerHTML = data;
            var el = tmp.querySelector(".edit_area");
            var text = el ? el.textContent.trim() : tmp.textContent.trim();
            if (type === "sort" || type === "type") {
              var parts = text.split("/");
              if (parts.length === 3) {
                return parts[2] + parts[1] + parts[0];
              }
            }
            return text;
          },
        },
        {
          // Issue date (col 6): DD/MM/YYYY → YYYYMMDD for chronological sort
          targets: 6,
          render: function (data, type) {
            if (type === "display") return data;
            var tmp = document.createElement("div");
            tmp.innerHTML = data;
            var el = tmp.querySelector(".edit_area");
            var text = el ? el.textContent.trim() : tmp.textContent.trim();
            if (type === "sort" || type === "type") {
              var parts = text.split("/");
              if (parts.length === 3) {
                return parts[2] + parts[1] + parts[0];
              }
            }
            return text;
          },
        },
        {
          // Hidden year column (col 10): not visible
          targets: 10,
          visible: false,
        },
      ],
    });

    // ===== Column filters =====
    function escapeRegex(s) {
      return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    }

    function buildUniqueColValues(colIdx) {
      var seen = {};
      var vals = [];
      dtTable
        .column(colIdx)
        .data()
        .each(function (cellHtml) {
          var tmp = document.createElement("div");
          tmp.innerHTML = cellHtml;
          var el =
            tmp.querySelector(".metadata_option_display") ||
            tmp.querySelector(".edit_area");
          var text = el ? el.textContent.trim() : tmp.textContent.trim();
          text.split("\n").forEach(function (v) {
            v = v.trim();
            if (v && !seen[v]) {
              seen[v] = true;
              vals.push(v);
            }
          });
        });
      return vals.sort();
    }

    var filterConfigs = [
      { label: "Location", colIdx: 8, multiVal: false },
      { label: "Category", colIdx: 9, multiVal: true },
      { label: "Year of issue", colIdx: 10, multiVal: false },
    ];

    var $filterBar = $('<div class="dt-filter-bar"></div>');
    var $activeFiltersRow = $('<div class="dt-active-filters"></div>').hide();
    var $pillsContainer = $('<div class="dt-active-pills"></div>');
    var $clearBtn = $(
      '<button type="button" class="dt-clear-filters ntgc-btn btn-sm ntgc-btn--tertiary">Clear filters</button>',
    );
    $activeFiltersRow.append(
      $('<span class="dt-active-label">Applied filters:</span>'),
      $pillsContainer,
      $clearBtn,
    );

    var filterSelects = {};

    function applyColumnFilter(cfg, val) {
      if (val === "") {
        dtTable.column(cfg.colIdx).search("");
      } else if (cfg.multiVal) {
        dtTable.column(cfg.colIdx).search(escapeRegex(val), true, false);
      } else {
        dtTable
          .column(cfg.colIdx)
          .search("^" + escapeRegex(val) + "$", true, false);
      }
    }

    function updateActiveFilters() {
      $pillsContainer.empty();
      var anyActive = false;

      // Search term pill
      var searchTerm = dtTable.search();
      if (searchTerm !== "") {
        anyActive = true;
        var $searchPill = $('<span class="dt-filter-pill"></span>').text(
          'Search: "' + searchTerm + '"',
        );
        var $sx = $(
          '<button type="button" class="dt-pill-remove" aria-label="Remove search filter">\u00d7</button>',
        );
        $sx.on("click", function () {
          dtTable.search("").draw();
          $(dtTable.table().container())
            .find(".dataTables_filter input")
            .val("");
          updateActiveFilters();
        });
        $searchPill.append($sx);
        $pillsContainer.append($searchPill);
      }

      // Column filter pills
      filterConfigs.forEach(function (cfg) {
        var $sel = filterSelects[cfg.colIdx];
        var val = $sel.val();
        if (val === "") return;
        anyActive = true;
        var $pill = $('<span class="dt-filter-pill"></span>').text(
          cfg.label + ": " + val,
        );
        var $x = $(
          '<button type="button" class="dt-pill-remove" aria-label="Remove filter">\u00d7</button>',
        );
        $x.on("click", function () {
          $sel.val("");
          applyColumnFilter(cfg, "");
          dtTable.draw();
          updateActiveFilters();
        });
        $pill.append($x);
        $pillsContainer.append($pill);
      });

      if (anyActive) {
        $activeFiltersRow.show();
      } else {
        $activeFiltersRow.hide();
      }
    }

    $clearBtn.on("click", function () {
      dtTable.search("");
      $(dtTable.table().container()).find(".dataTables_filter input").val("");
      filterConfigs.forEach(function (cfg) {
        filterSelects[cfg.colIdx].val("");
        applyColumnFilter(cfg, "");
      });
      dtTable.draw();
      updateActiveFilters();
    });

    filterConfigs.forEach(function (cfg) {
      var $sel = $(
        '<select class="dt-filter-select custom-select custom-select-sm form-control form-control-sm"></select>',
      );
      var defaultLabel;
      if (cfg.label === "Location") {
        defaultLabel = "All locations";
      } else if (cfg.label === "Category") {
        defaultLabel = "All categories";
      } else if (cfg.label === "Year of issue") {
        defaultLabel = "All years";
      } else {
        defaultLabel = "All " + cfg.label + "s";
      }
      $sel.append($('<option value="">' + defaultLabel + "</option>"));
      buildUniqueColValues(cfg.colIdx).forEach(function (v) {
        $sel.append($("<option></option>").val(v).text(v));
      });
      $sel.on("change", function () {
        applyColumnFilter(cfg, $(this).val());
        dtTable.draw();
        updateActiveFilters();
      });
      filterSelects[cfg.colIdx] = $sel;
      var $wrapper = $('<div class="dt-filter-item"></div>');
      var $lbl = $('<label class="dt-filter-label"></label>').text(cfg.label);
      $wrapper.append($lbl, $sel);
      $filterBar.append($wrapper);
    });

    // Move DataTables search box into the filter bar
    $filterBar.prepend(
      $(dtTable.table().container()).find(".dataTables_filter"),
    );

    // Move DataTables length control into the filter bar, right-aligned
    $filterBar.append(
      $(dtTable.table().container())
        .find(".dataTables_length")
        .addClass("dt-length-right"),
    );

    // Reflect search term changes in the pills row
    dtTable.on("search.dt", function () {
      updateActiveFilters();
    });

    var $tableNode = $(dtTable.table().node());
    var $wrapperNode = $tableNode.closest(".dataTables_wrapper");
    $tableNode.before($filterBar);
    $tableNode.before($activeFiltersRow);
  });
})(jQuery);
