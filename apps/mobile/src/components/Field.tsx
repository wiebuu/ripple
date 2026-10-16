import { useState, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { fonts, radius, space, useTheme } from '@/theme';
import { Icon, T } from './ui';

type Props = TextInputProps & {
  ref?: Ref<any>;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  max?: number;
  /** Soft limit: show the counter but allow typing past it (validation explains). */
  softMax?: boolean;
};

/** Labelled input with helper text, inline error and optional character counter. */
export function Field({ label, required, helper, error, max, softMax, multiline, value, style, ref, ...rest }: Props) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const len = value?.length ?? 0;
  const over = max != null && len > max;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T variant="smallStrong">
          {label}
          {required ? <T variant="smallStrong" color="danger">{' *'}</T> : <T variant="small" color="textSubtle">{'  optional'}</T>}
        </T>
        {max != null && (
          <T variant="small" color={over ? 'danger' : len > max * 0.9 ? 'warning' : 'textSubtle'} accessibilityLabel={`${len} of ${max} characters`}>
            {len}/{max}
          </T>
        )}
      </View>
      <TextInput
        ref={ref}
        value={value}
        multiline={multiline}
        maxLength={max && !softMax ? max : undefined}
        placeholderTextColor={c.textSubtle}
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          {
            minHeight: multiline ? 104 : 48,
            paddingHorizontal: space.md,
            paddingTop: multiline ? 12 : 0,
            paddingBottom: multiline ? 12 : 0,
            borderRadius: radius.md,
            borderWidth: focused ? 1.5 : 1,
            borderColor: error ? c.danger : focused ? c.primary : c.border,
            backgroundColor: c.surface,
            color: c.text,
            fontFamily: fonts.sans,
            fontSize: 16,
            lineHeight: multiline ? 22 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={15} color={c.danger} style={{ marginTop: 2 }} />
          <T variant="small" color="danger" style={{ flex: 1 }}>
            {error}
          </T>
        </View>
      ) : helper ? (
        <T variant="small" color="textMuted">
          {helper}
        </T>
      ) : null}
    </View>
  );
}
