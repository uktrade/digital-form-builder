import React, { useContext } from "react";
import { ComponentContext } from "../reducers/component/componentReducer";
import { Actions } from "../reducers/component/types";
import { Input } from "@govuk-jsx/input";
import { withI18n } from "../i18n";
import classNames from "classnames";

function DetailsEdit({ i18n, context = ComponentContext }) {
  const [
    { selectedComponent, shouldValidate, errors = {} },
    dispatch,
  ] = useContext(context);

  return (
    <div>
      <Input
        id="details-title"
        name="title"
        label={{
          className: "govuk-label--s",
          children: ["Title"],
        }}
        value={selectedComponent.title}
        onChange={(e) =>
          dispatch({
            type: Actions.EDIT_TITLE,
            payload: e.target.value,
          })
        }
        errorMessage={
          errors?.title
            ? { children: i18n(...errors.title.children) }
            : undefined
        }
      />

      <div
        className={classNames({
          "govuk-form-group": true,
          "govuk-form-group--error": errors?.content,
        })}
      >
        <label className="govuk-label" htmlFor="details-content">
          Content
        </label>
        <span className="govuk-hint">
          The content can include HTML and the `govuk-prose-scope` css class is
          available. Use this on a wrapping element to apply default govuk
          styles.
        </span>
        {errors?.content && (
          <span className="govuk-error-message">
            <span className="govuk-visually-hidden">{i18n("error")}</span>{" "}
            {i18n(...errors.content.children)}
          </span>
        )}
        <textarea
          className="govuk-textarea"
          id="details-content"
          name="content"
          defaultValue={selectedComponent.content}
          rows="10"
          onChange={(e) =>
            dispatch({
              type: Actions.EDIT_CONTENT,
              payload: e.target.value,
            })
          }
        />
      </div>
    </div>
  );
}

export default withI18n(DetailsEdit);